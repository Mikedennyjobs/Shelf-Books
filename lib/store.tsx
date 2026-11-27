"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { api } from "./client";
import { usePlayer } from "./player";
import { Ref, Shelf, SHELF_LABEL } from "./types";

const Ctx = createContext<any>(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ session, children }: { session: any; children: React.ReactNode }) {
  const uid: string = session.user.id;
  const [profile, setProfile] = useState<any>(null);
  const [lib, setLib] = useState<any[]>([]);
  const [narrators, setNarrators] = useState<any[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [stack, setStack] = useState<{ name: string; arg?: any }[]>([]);
  const [tab, setTabState] = useState("home");
  const [sheet, setSheet] = useState<any>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [requests, setRequests] = useState(0);
  const libRef = useRef<any[]>([]);
  const toastT = useRef<any>(null);

  const toast = (m: string) => {
    setToastMsg(m);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastMsg(""), 2200);
  };

  /* ---------- data loading ---------- */
  const refreshLib = useCallback(async () => {
    const { data } = await supabase
      .from("library")
      .select("book_id,shelf,rating,idx,total,added_at,finished_at,updated_at,books(*)")
      .eq("user_id", uid)
      .order("updated_at", { ascending: false });
    const rows = (data || []).filter((r: any) => r.books);
    libRef.current = rows;
    setLib(rows);
  }, [uid]);
  const refreshNarrators = useCallback(async () => {
    const { data } = await supabase.from("narrators").select("id,name,consent_at").order("created_at");
    setNarrators(data || []);
  }, []);
  const refreshStats = useCallback(async () => {
    const r = await api("/api/stats");
    if (r.ok) setStats(await r.json());
  }, []);
  const refreshRequests = useCallback(async () => {
    const { count } = await supabase.from("friendships").select("id", { count: "exact", head: true }).eq("addressee", uid).eq("status", "pending");
    setRequests(count || 0);
  }, [uid]);

  useEffect(() => {
    (async () => {
      let { data: p } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (!p) {
        const name = (session.user.email || "reader").split("@")[0];
        const ins = await supabase.from("profiles").insert({ id: uid, display_name: name, username: name.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 16) + Math.floor(1000 + Math.random() * 9000) }).select("*").single();
        p = ins.data;
      }
      setProfile(p);
      await Promise.all([refreshLib(), refreshNarrators(), refreshStats(), refreshRequests()]);

      // Invite links look like /?invite=username
      const inv = new URLSearchParams(window.location.search).get("invite");
      if (inv && p) {
        window.history.replaceState({}, "", window.location.pathname);
        const { data: other } = await supabase.from("profiles").select("id,display_name").eq("username", inv.toLowerCase()).maybeSingle();
        if (other && other.id !== uid) {
          const { error } = await supabase.from("friendships").insert({ requester: uid, addressee: other.id });
          toast(error ? "You are already connected with " + other.display_name : "Friend request sent to " + other.display_name);
        }
      }
    })();
  }, [uid]);

  async function updateProfile(patch: any) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", uid);
    if (!error) setProfile((p: any) => ({ ...p, ...patch }));
    return error;
  }

  /* ---------- navigation ---------- */
  const go = (name: string, arg?: any) => { setSheet(null); setStack((s) => [...s, { name, arg }]); };
  const back = () => setStack((s) => s.slice(0, -1));
  const setTab = (t: string) => { setStack([]); setSheet(null); setTabState(t); };
  const openSheet = (s: any) => setSheet(s);
  const closeSheet = () => setSheet(null);

  /* ---------- library ---------- */
  const findRow = (r: Ref) =>
    libRef.current.find((x: any) => (r.bookId && x.book_id === r.bookId) || (!r.bookId && x.books.source === r.source && x.books.source_id === r.sourceId));
  const shelfOf = (r: Ref): Shelf | null => findRow(r)?.shelf || null;

  async function logActivity(type: string, bookId: string, rating?: number) {
    await supabase.from("activity").insert({ user_id: uid, type, book_id: bookId, rating: rating ?? null });
  }

  async function ensureSaved(r: Ref, shelf: Shelf = "want"): Promise<string | null> {
    const row = findRow(r);
    if (row) return row.book_id;
    if (r.bookId && r.source === "upload") return r.bookId;
    setSaving(r.key);
    const res = await api("/api/save", {
      method: "POST",
      body: JSON.stringify({ source: r.source, sourceId: r.sourceId, title: r.title, author: r.author, authorYears: r.authorYears, cover: r.cover, summary: r.summary, subjects: r.subjects, textUrls: r.textUrls, epub: r.epub, pdf: r.pdf, shelf }),
    });
    const d = await res.json();
    setSaving(null);
    if (!res.ok) { toast(d.error || "Could not save this book."); return null; }
    await refreshLib();
    return d.bookId;
  }

  async function setShelf(r: Ref, shelf: Shelf | null) {
    if (shelf === null) {
      const row = findRow(r);
      if (row) { await supabase.from("library").delete().eq("book_id", row.book_id).eq("user_id", uid); await refreshLib(); toast("Removed from your books"); }
      return;
    }
    const id = await ensureSaved(r, shelf);
    if (!id) return;
    const prev = libRef.current.find((x: any) => x.book_id === id)?.shelf;
    const patch: any = { shelf, updated_at: new Date().toISOString() };
    if (shelf === "finished") patch.finished_at = new Date().toISOString();
    await supabase.from("library").update(patch).eq("book_id", id).eq("user_id", uid);
    if (prev !== shelf && (shelf === "listening" || shelf === "finished")) logActivity(shelf === "listening" ? "started" : "finished", id);
    await refreshLib();
    if (shelf === "finished") refreshStats();
    toast("Moved to " + SHELF_LABEL[shelf]);
  }

  async function rate(r: Ref, n: number) {
    const id = await ensureSaved(r, "want");
    if (!id) return;
    await supabase.from("library").update({ rating: n, updated_at: new Date().toISOString() }).eq("book_id", id).eq("user_id", uid);
    logActivity("rated", id, n);
    await refreshLib();
    toast(`Rated ${n} ${n === 1 ? "star" : "stars"}`);
  }

  /* ---------- player ---------- */
  const player = usePlayer({
    uid,
    voiceId,
    toast,
    onPlayStart: (id) => {
      const row = libRef.current.find((x: any) => x.book_id === id);
      if (row && row.shelf === "want") {
        supabase.from("library").update({ shelf: "listening", updated_at: new Date().toISOString() }).eq("book_id", id).eq("user_id", uid).then(() => { logActivity("started", id); refreshLib(); });
      }
    },
    onFinish: async (id) => {
      await supabase.from("library").update({ shelf: "finished", finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("book_id", id).eq("user_id", uid);
      logActivity("finished", id);
      await refreshLib();
      refreshStats();
      toast("Finished. Moved to your Finished shelf.");
      setStack((s) => (s[s.length - 1]?.name === "player" ? s.slice(0, -1) : s));
    },
    onProgress: (id, idx, total) => {
      libRef.current = libRef.current.map((x: any) => (x.book_id === id ? { ...x, idx, total } : x));
      setLib(libRef.current);
    },
  });

  useEffect(() => {
    if (profile?.prefs?.speed) player.setRate(profile.prefs.speed);
    if (profile?.prefs?.voiceId) setVoiceId(profile.prefs.voiceId);
  }, [profile?.id]);

  async function playBook(r: Ref, fromIdx?: number) {
    const id = await ensureSaved(r, "listening");
    if (!id) return;
    const row = libRef.current.find((x: any) => x.book_id === id);
    const ok = await player.open(id, fromIdx ?? row?.idx ?? 0);
    if (!ok) return;
    if (fromIdx !== undefined) player.jump(fromIdx);
    go("player", id);
    player.play();
  }

  const value = {
    uid, session, profile, updateProfile, lib, findRow, shelfOf, setShelf, rate, ensureSaved, saving, refreshLib,
    narrators, refreshNarrators, voiceId, setVoiceId,
    stack, tab, go, back, setTab, sheet, openSheet, closeSheet, toast, toastMsg,
    stats, refreshStats, filter, setFilter, requests, refreshRequests,
    player, playBook, logActivity,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
