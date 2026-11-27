"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { api } from "./client";

const toParas = (t: string) => t.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
const textCache = new Map<string, string[]>();

function splitPieces(t: string, max = 220) {
  const s = t.match(/[^.!?]+[.!?]+["'\u201D\u2019)\]]*\s*|[^.!?]+$/g) || [t];
  const out: string[] = [];
  let cur = "";
  for (const x of s) {
    if ((cur + x).length > max && cur) { out.push(cur.trim()); cur = ""; }
    if (x.length > max) {
      let c = "";
      for (const w of x.split(" ")) { if ((c + " " + w).length > max) { out.push(c.trim()); c = w; } else c += " " + w; }
      cur = c;
    } else cur += x;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

type Opts = {
  uid: string;
  voiceId: string;
  toast: (m: string) => void;
  onPlayStart: (bookId: string) => void;
  onFinish: (bookId: string) => void;
  onProgress: (bookId: string, idx: number, total: number) => void;
};

// Reads a book aloud. A paragraph recorded in the chosen voice plays as audio, anything else uses the device voice.
export function usePlayer(o: Opts) {
  const [bookId, setBookId] = useState<string | null>(null);
  const [paras, setParas] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rate, setRate] = useState(1);
  const [sleepMin, setSleepMin] = useState(0);
  const [recUrls, setRecUrls] = useState<Record<number, string>>({});
  const [ttsVoices, setTtsVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ttsVoice, setTtsVoice] = useState("");
  const [speechOk, setSpeechOk] = useState(true);

  const token = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const live = useRef<any>({ paras: [], rate: 1, ttsVoice: "", recUrls: {}, bookId: null, idx: 0 });
  const clock = useRef(0);
  live.current.rate = rate;
  live.current.ttsVoice = ttsVoice;
  live.current.recUrls = recUrls;
  const opts = useRef(o);
  opts.current = o;

  /* device voices */
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => {
      const v = speechSynthesis.getVoices();
      setTtsVoices(v);
      setTtsVoice((cur) => cur || (v.find((x) => x.lang?.startsWith("en")) || v[0])?.voiceURI || "");
    };
    load();
    speechSynthesis.onvoiceschanged = load;
    return () => { speechSynthesis.onvoiceschanged = null; };
  }, []);

  /* recorded voice links */
  async function reloadRecs() {
    const id = live.current.bookId;
    if (!id || !o.voiceId) { setRecUrls({}); return; }
    const r = await api(`/api/rec-urls?book=${id}&narrator=${o.voiceId}`);
    const d = await r.json();
    setRecUrls(d.urls || {});
  }
  useEffect(() => { reloadRecs(); }, [bookId, o.voiceId]);

  /* listening time (feeds streaks, hours and challenges) */
  function flush() {
    if (!clock.current) return;
    const s = Math.round((Date.now() - clock.current) / 1000);
    clock.current = Date.now();
    if (s > 0) supabase.rpc("add_listen", { s });
  }
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(flush, 30000);
    return () => clearInterval(t);
  }, [playing]);

  /* save position */
  useEffect(() => {
    if (!bookId || !paras.length) return;
    const t = setTimeout(async () => {
      await supabase.from("library").update({ idx, total: paras.length, updated_at: new Date().toISOString() }).eq("book_id", bookId).eq("user_id", o.uid);
      opts.current.onProgress(bookId, idx, paras.length);
    }, 800);
    return () => clearTimeout(t);
  }, [idx, bookId, paras.length]);

  /* sleep timer */
  useEffect(() => {
    if (!playing || !sleepMin) return;
    const t = setTimeout(() => { stop(); setSleepMin(0); opts.current.toast("Sleep timer ended"); }, sleepMin * 60000);
    return () => clearTimeout(t);
  }, [playing, sleepMin]);

  useEffect(() => () => { token.current++; if ("speechSynthesis" in window) speechSynthesis.cancel(); audio.current?.pause(); }, []);

  async function open(id: string, start = 0) {
    if (live.current.bookId === id && live.current.paras.length) return true;
    stop();
    setLoading(true);
    let ps = textCache.get(id);
    if (!ps) {
      const r = await api(`/api/book/${id}`);
      if (!r.ok) { setLoading(false); opts.current.toast("Could not open this book."); return false; }
      ps = toParas(await r.text());
      textCache.set(id, ps);
    }
    live.current.bookId = id;
    live.current.paras = ps;
    live.current.idx = Math.min(start, Math.max(0, ps.length - 1));
    setBookId(id); setParas(ps); setIdx(live.current.idx); setLoading(false);
    return true;
  }

  function stop() {
    token.current++;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    audio.current?.pause();
    flush();
    clock.current = 0;
    setPlaying(false);
  }

  function speakFrom(start: number) {
    if (!audio.current) audio.current = new Audio();
    const a = audio.current;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    a.pause();
    const t = ++token.current;
    setPlaying(true);
    clock.current = Date.now();
    if (live.current.bookId) opts.current.onPlayStart(live.current.bookId);

    // If the device voice keeps failing or ends instantly, stop instead of racing through the book and marking it finished.
    let fails = 0;
    const bail = () => {
      stop();
      setSpeechOk(false);
      opts.current.toast("Your device could not read aloud. Try Chrome or Safari, or open the app outside an in-app browser.");
    };

    const go = (p: number) => {
      if (t !== token.current) return;
      const ps: string[] = live.current.paras;
      if (p >= ps.length) { const id = live.current.bookId; stop(); if (id) opts.current.onFinish(id); return; }
      live.current.idx = p;
      setIdx(p);
      const tts = () => {
        if (!("speechSynthesis" in window)) { setSpeechOk(false); setPlaying(false); return; }
        const pieces = splitPieces(ps[p]);
        let k = 0;
        const next = () => {
          if (t !== token.current) return;
          if (k >= pieces.length) { go(p + 1); return; }
          const u = new SpeechSynthesisUtterance(pieces[k++]);
          const v = speechSynthesis.getVoices().find((x) => x.voiceURI === live.current.ttsVoice);
          if (v) u.voice = v;
          u.rate = live.current.rate;
          const began = Date.now();
          u.onend = () => {
            if (Date.now() - began < 80 && u.text.length > 25) { if (++fails >= 4) { bail(); return; } } else fails = 0;
            next();
          };
          u.onerror = (ev: any) => {
            if (ev.error === "interrupted" || ev.error === "canceled") return;
            if (ev.error === "not-allowed") { token.current++; setPlaying(false); setSpeechOk(false); return; }
            if (++fails >= 4) { bail(); return; }
            next();
          };
          speechSynthesis.speak(u);
        };
        next();
      };
      const url = live.current.recUrls[p];
      if (url) {
        a.onended = () => go(p + 1);
        a.onerror = () => { if (t === token.current) tts(); };
        a.src = url;
        a.playbackRate = live.current.rate;
        a.play().catch(() => { if (t === token.current) tts(); });
      } else tts();
    };
    go(start);
  }

  const play = () => speakFrom(live.current.idx);
  const toggle = () => (playing ? stop() : speakFrom(live.current.idx));
  function jump(n: number) {
    const t = Math.max(0, Math.min(live.current.paras.length - 1, n));
    live.current.idx = t;
    setIdx(t);
    if (playing) speakFrom(t);
  }
  async function bookmarkHere() {
    if (!live.current.bookId) return;
    const label = (live.current.paras[live.current.idx] || "").slice(0, 70);
    const { error } = await supabase.from("bookmarks").insert({ user_id: o.uid, book_id: live.current.bookId, para_idx: live.current.idx, label });
    opts.current.toast(error ? "Could not add the bookmark" : "Bookmark added at this paragraph");
  }

  return { bookId, paras, idx, playing, loading, rate, setRate, sleepMin, setSleepMin, recUrls, reloadRecs, ttsVoices, ttsVoice, setTtsVoice, speechOk, open, stop, play, toggle, jump, bookmarkHere, speakFrom };
}
