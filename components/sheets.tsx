"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api, timeAgo } from "@/lib/client";
import { SHELF_LABEL, Shelf } from "@/lib/types";
import { useApp } from "@/lib/store";
import { Icon, Spinner } from "./ui";

export const FEATURES: Record<string, string[]> = {
  home: ["Currently Listening: resume any book where you stopped, with % listened", "Ask and Resume buttons right on the card", "Listening Challenge: a yearly goal that counts finished books", "Friend activity: see what friends start, finish and rate", "Saved to your library: books you added from Search, the web scout or uploads"],
  mybooks: ["Three shelves: Currently Listening, Want to Listen, Finished", "Progress bar on every book you have started", "Star ratings on finished books", "Shelf button: move a book between shelves or remove it", "Everything saves to your account and syncs across devices"],
  discover: ["Popular free classics", "Rows built from your own shelves: Because you listened to…", "Popular by genre with one-tap Want to Listen", "Rate a book without opening it", "Every book is free and legal: public domain or Creative Commons"],
  search: ["Search Project Gutenberg and the Internet Archive by title or author", "Browse by genre tiles", "Scout the web with Claude: finds official free copies and never returns pirate sites", "Add your own EPUB, PDF or TXT, private to you", "A book saved once is stored for everyone, so the next person gets it instantly"],
  genre: ["Every free book in the genre", "Source shown on each result", "One-tap Want to Listen"],
  collection: ["A list of free books picked for you", "Save any book straight to a shelf"],
  book: ["Listen or Resume with your saved position", "Ask about a passage: plain-language answers", "Record a voice: read the book yourself, or with someone who agrees to be recorded", "Listen with: computer voice or any recorded voice", "EPUB and PDF links with the source and licence", "Rate it, shelve it, add bookmarks"],
  player: ["Read-aloud with the current paragraph highlighted", "Progress saved automatically on every paragraph", "Speed and sleep timer", "Voice switcher: recorded paragraphs play in the recorded voice, the rest in the device voice", "Bookmark, Ask and Record without leaving the player"],
  picks: ["Recommendations based on your shelves", "Reason shown under every pick", "One-tap Want to Listen"],
  voices: ["Record yourself, or a loved one who agrees, one paragraph at a time", "A consent tick is required before any voice is created", "See how many paragraphs are recorded in each book", "Delete a voice and every recording in it at any time", "Voices are private to your account"],
  upload: ["Add EPUB, PDF or TXT files you own", "Text is extracted so it can be read aloud", "Uploads stay private to you", "Scanned PDFs without text are rejected with a clear message"],
  askhist: ["Every question you asked, grouped by book", "Tap a thread to jump back to that book", "Daily question limit shown in Settings"],
  profile: ["Your name and username, which friends use to find you", "Hours, finished books, voices and friends", "Daily goal and streak", "Shelf counts that open your library"],
  challenges: ["Yearly Listening Challenge with a goal you can edit", "Join short challenges like 30 Days of Classics", "Progress updates as you listen and finish books"],
  friends: ["Find friends by name or username", "Share an invite link", "See what friends are listening to", "Friends see only what you choose to share. Voices and uploads are never shared."],
  groups: ["Join listening groups by interest", "Post and read discussions inside a group", "Start your own group"],
  group: ["Members-only discussion", "Post, and delete your own posts", "Group owners can remove any post"],
  settings: ["Default speed and daily goal", "Control whether friends see your activity", "Edit your name and username", "Delete all voices, or delete your account and everything in it"],
};

const wrap = (app: any, inner: React.ReactNode) => (
  <div className="scrim" onClick={app.closeSheet}>
    <div className="sheet" onClick={(e) => e.stopPropagation()}><div className="grab" />{inner}</div>
  </div>
);

export function SheetHost() {
  const app = useApp();
  const s = app.sheet;
  if (!s) return null;
  switch (s.type) {
    case "more": return <MoreSheet />;
    case "info": return <InfoSheet />;
    case "bell": return <BellSheet />;
    case "shelf": return <ShelfSheet r={s.ref} />;
    case "ask": return <AskSheet bookId={s.bookId} />;
    case "record": return <RecordSheet bookId={s.bookId} />;
    case "scout": return <ScoutSheet />;
    case "newgroup": return <NewGroupSheet />;
    default: return null;
  }
}

/* ---------------- More ---------------- */
function MoreSheet() {
  const app = useApp();
  const items = [["My Profile", "user", "profile"], ["Top picks for you", "picks", "picks"], ["Listening Challenges", "trophy", "challenges"], ["Add Friends", "users", "friends"], ["Groups", "users", "groups"], ["My Voices", "mic", "voices"], ["Upload a Book", "upload", "upload"], ["Ask History", "chat", "askhist"], ["Settings", "settings", "settings"]];
  return wrap(app, <div className="grid3">{items.map(([l, i, k]) => (
    <button key={k} className="mi" onClick={() => app.go(k)}><div className="mc"><Icon n={i} s={36} /></div><span>{l}</span></button>
  ))}</div>);
}

/* ---------------- Info ---------------- */
function InfoSheet() {
  const app = useApp();
  const top = app.stack[app.stack.length - 1];
  const name = top?.name || app.tab;
  return wrap(app, <>
    <h3>On this screen</h3>
    <ul className="flist">{(FEATURES[name] || []).map((f) => <li key={f}>{f}</li>)}</ul>
  </>);
}

/* ---------------- Notifications ---------------- */
function BellSheet() {
  const app = useApp();
  const [reqs, setReqs] = useState<any[] | null>(null);
  const [feed, setFeed] = useState<any[]>([]);
  async function load() {
    const r = await supabase.from("friendships").select("id,rp:profiles!friendships_requester_fkey(display_name,username)").eq("addressee", app.uid).eq("status", "pending");
    setReqs(r.data || []);
    const a = await supabase.from("activity").select("id,type,rating,created_at,profiles(display_name),books(title)").neq("user_id", app.uid).order("created_at", { ascending: false }).limit(5);
    setFeed((a.data || []).filter((x: any) => x.books));
  }
  useEffect(() => { load(); }, []);
  async function accept(id: string) { await supabase.from("friendships").update({ status: "accepted" }).eq("id", id); await app.refreshRequests(); app.refreshStats(); load(); }
  async function decline(id: string) { await supabase.from("friendships").delete().eq("id", id); await app.refreshRequests(); load(); }
  const verb: any = { started: "started", finished: "finished", rated: "rated" };
  return wrap(app, <>
    <h3>Notifications</h3>
    {reqs === null ? <div className="empty"><Spinner /></div> : (
      <>
        {reqs.map((r) => (
          <div className="person" key={r.id} style={{ padding: "12px 0" }}>
            <div className="grow"><b>{r.rp?.display_name}</b><div className="sub">wants to be your friend</div></div>
            <button className="pill green small" onClick={() => accept(r.id)}>Accept</button>
            <button className="link" onClick={() => decline(r.id)}>Decline</button>
          </div>
        ))}
        {feed.map((a) => (
          <div key={a.id} style={{ padding: "12px 0", borderBottom: "1px solid #EFEAE0", fontSize: 15 }}>
            <b>{a.profiles?.display_name}</b> {verb[a.type]} {a.books.title}{a.type === "rated" ? ` (${a.rating} stars)` : ""}
            <div className="sub">{timeAgo(a.created_at)}</div>
          </div>
        ))}
        {!reqs.length && !feed.length && <p className="sub" style={{ padding: "16px 0" }}>Nothing new. Friend requests and friend activity show up here.</p>}
      </>
    )}
  </>);
}

/* ---------------- Shelf picker ---------------- */
function ShelfSheet({ r }: any) {
  const app = useApp();
  const cur = app.shelfOf(r);
  const pick = (k: Shelf | null) => { app.closeSheet(); app.setShelf(r, k); };
  return wrap(app, <>
    <h3 style={{ marginBottom: 8 }}>{r.title}</h3>
    {(["want", "listening", "finished"] as Shelf[]).map((k) => (
      <button key={k} className="opt-row" onClick={() => pick(k)}><span>{SHELF_LABEL[k]}</span>{cur === k && <Icon n="check" s={22} />}</button>
    ))}
    {cur && <button className="opt-row" style={{ color: "#B3392C" }} onClick={() => pick(null)}><span>Remove from my books</span></button>}
  </>);
}

/* ---------------- Ask ---------------- */
function AskSheet({ bookId }: { bookId: string }) {
  const app = useApp();
  const pl = app.player;
  const row = app.lib.find((x: any) => x.book_id === bookId);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { pl.stop(); if (pl.bookId !== bookId) pl.open(bookId, row?.idx || 0); }, [bookId]);
  const ready = pl.bookId === bookId && pl.paras.length > 0;
  const cur: string = ready ? pl.paras[pl.idx] || "" : "";
  const passage = ready ? pl.paras.slice(Math.max(0, pl.idx - 2), pl.idx + 1).join("\n\n") : "";

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy || !ready) return;
    setQ("");
    const hist = [...msgs, { role: "user", content: t }];
    setMsgs(hist); setBusy(true);
    try {
      const r = await api("/api/ask", { method: "POST", body: JSON.stringify({ bookId, passage, messages: hist }) });
      const d = await r.json();
      setMsgs([...hist, { role: "assistant", content: r.ok ? d.reply : d.error || "Something went wrong. Try again." }]);
    } catch {
      setMsgs([...hist, { role: "assistant", content: "Could not reach the assistant. Check your connection and try again." }]);
    }
    setBusy(false);
  }
  return wrap(app, <>
    <h3>Ask about this passage</h3>
    <div className="sub">{row?.books?.title}</div>
    {!ready ? <div className="empty"><Spinner /></div> : (
      <>
        <p className="quote">{cur.length > 220 ? cur.slice(0, 220) + "…" : cur}</p>
        {!msgs.length && ["Explain this in simple words", "What is happening here?", "Why does this matter in the story?"].map((t) => (
          <button key={t} className="qchip" onClick={() => send(t)}>{t}</button>
        ))}
        <div className="msgs">{msgs.map((m, i) => <div key={i} className={`bub ${m.role === "user" ? "u" : "a"}`}>{m.content}</div>)}{busy && <p className="sub">Thinking…</p>}</div>
        <form className="inputrow" onSubmit={(e) => { e.preventDefault(); send(q); }}>
          <input placeholder="Ask a question" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="pill brown small" type="submit">Send</button>
        </form>
      </>
    )}
  </>);
}

/* ---------------- Record a voice ---------------- */
function RecordSheet({ bookId }: { bookId: string }) {
  const app = useApp();
  const pl = app.player;
  const row = app.lib.find((x: any) => x.book_id === bookId);
  const [adding, setAdding] = useState(app.narrators.length === 0);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const [msg, setMsg] = useState("");
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const t0 = useRef(0);
  const timer = useRef<any>(null);
  const target = useRef(0);
  const cancelled = useRef(false);

  useEffect(() => {
    pl.stop();
    if (pl.bookId !== bookId) pl.open(bookId, row?.idx || 0);
    return () => { cancelled.current = true; clearInterval(timer.current); if (mr.current && mr.current.state === "recording") mr.current.stop(); };
  }, [bookId]);

  const ready = pl.bookId === bookId && pl.paras.length > 0;
  const cur: string = ready ? pl.paras[pl.idx] || "" : "";

  async function createVoice() {
    if (!name.trim() || !consent) return;
    const { data, error } = await supabase.from("narrators").insert({ user_id: app.uid, name: name.trim() }).select("id").single();
    if (error) { setMsg(error.message); return; }
    await app.refreshNarrators(); app.setVoiceId(data.id);
    setAdding(false); setName(""); setConsent(false); setMsg("");
  }
  async function start() {
    setMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = async () => { stream.getTracks().forEach((t) => t.stop()); if (!cancelled.current) await finish(rec.mimeType || mime || "audio/webm"); };
      target.current = pl.idx; t0.current = Date.now(); setSecs(0);
      timer.current = setInterval(() => setSecs(Math.round((Date.now() - t0.current) / 1000)), 500);
      rec.start(); mr.current = rec; setOn(true);
    } catch {
      setMsg("The microphone is blocked. Allow microphone access for this site in your browser settings, then try again.");
    }
  }
  function stop() { clearInterval(timer.current); mr.current?.stop(); setOn(false); }
  async function finish(mime: string) {
    setBusy(true);
    try {
      const blob = new Blob(chunks.current, { type: mime });
      const ext = mime.includes("mp4") ? "m4a" : "webm";
      const i = target.current;
      const u = await (await api("/api/rec-upload-url", { method: "POST", body: JSON.stringify({ narratorId: app.voiceId, bookId, idx: i, ext }) })).json();
      if (u.error) throw new Error(u.error);
      const up = await supabase.storage.from("books").uploadToSignedUrl(u.path, u.token, blob, { contentType: mime.split(";")[0] });
      if (up.error) throw new Error(up.error.message);
      const { error } = await supabase.from("recordings").upsert(
        { narrator_id: app.voiceId, user_id: app.uid, book_id: bookId, para_idx: i, path: u.path, seconds: (Date.now() - t0.current) / 1000 },
        { onConflict: "narrator_id,book_id,para_idx" });
      if (error) throw new Error(error.message);
      await pl.reloadRecs();
      pl.jump(i + 1);
      app.refreshStats();
      setMsg("Saved. The next paragraph is ready.");
    } catch (e: any) {
      setMsg(e.message || "Could not save that recording. Try again.");
    }
    setBusy(false);
  }
  const mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  return wrap(app, <>
    <h3>Record a voice</h3>
    <div className="sub">{row?.books?.title}</div>
    <div className="row wrap" style={{ margin: "12px 0" }}>
      {app.narrators.map((n: any) => <button key={n.id} className={`chip ${app.voiceId === n.id && !adding ? "on" : ""}`} onClick={() => { app.setVoiceId(n.id); setAdding(false); }}>{n.name}</button>)}
      <button className={`chip ${adding ? "on" : ""}`} onClick={() => setAdding(true)}>+ New voice</button>
    </div>
    {adding ? (
      <>
        <div className="sub" style={{ marginBottom: 6 }}>Whose voice is this?</div>
        <input className="field" placeholder="A name, for example Me or Amara" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>This is my own voice, or the person has agreed to be recorded and to have their voice used to read books. It can be deleted at any time.</span></label>
        <button className="pill brown wide" disabled={!name.trim() || !consent} onClick={createVoice}>Save voice</button>
      </>
    ) : !ready ? <div className="empty"><Spinner /></div> : !app.voiceId ? <p className="sub">Choose a voice above.</p> : (
      <>
        <p className="quote" style={{ fontSize: 17 }}>{cur}</p>
        {pl.recUrls[pl.idx] && !on && <div className="sub row" style={{ color: "var(--green)", gap: 6 }}><Icon n="check" s={14} /> Already recorded. Record again to replace it.</div>}
        <button className={`recbtn ${on ? "on" : ""}`} disabled={busy} aria-label={on ? "Stop" : "Record"} onClick={on ? stop : start}><Icon n={on ? "stop" : "mic"} s={38} /></button>
        <div className="sub" style={{ textAlign: "center" }}>{busy ? "Saving…" : on ? `Recording ${mm}. Tap to stop and save.` : "Tap, then read the paragraph aloud."}</div>
        <div className="row" style={{ justifyContent: "space-between", marginTop: 14 }}>
          <button className="pill ghost small" disabled={on || busy || pl.idx === 0} onClick={() => pl.jump(pl.idx - 1)}>Back</button>
          <button className="pill ghost small" disabled={on || busy} onClick={() => pl.jump(pl.idx + 1)}>Skip</button>
        </div>
      </>
    )}
    {msg && <p className={msg.startsWith("Saved") ? "ok" : "err"} style={{ marginTop: 12, color: msg.startsWith("Saved") ? "var(--green)" : "#B3392C", fontSize: 14 }}>{msg}</p>}
  </>);
}

/* ---------------- Web scout ---------------- */
function ScoutSheet() {
  const app = useApp();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function go() {
    if (!q.trim()) return;
    setBusy(true); setMsg(""); setRes(null);
    try {
      const r = await api("/api/scout", { method: "POST", body: JSON.stringify({ q }) });
      const d = await r.json();
      if (!r.ok) setMsg(d.error || "The scout could not run.");
      else { setRes(d.results || []); if (!(d.results || []).length) setMsg("No legal free copy found. If the book is in copyright, try borrowing it free from your library with the Libby app."); }
    } catch { setMsg("The scout could not run. Try again."); }
    setBusy(false);
  }
  return wrap(app, <>
    <h3>Claude's web scout</h3>
    <div className="sub" style={{ marginBottom: 12 }}>Looks for official free copies beyond the built-in libraries. Never returns pirate sites.</div>
    <form className="inputrow" onSubmit={(e) => { e.preventDefault(); go(); }}>
      <input placeholder="Book title" value={q} onChange={(e) => setQ(e.target.value)} />
      <button className="pill brown small" type="submit">Scout</button>
    </form>
    {busy && <p style={{ padding: "20px 0", textAlign: "center", color: "var(--gray)" }}>Searching the web…</p>}
    {msg && <p className="sub" style={{ margin: "14px 0", lineHeight: 1.45 }}>{msg}</p>}
    {res && res.length > 0 && <ul className="flist" style={{ marginTop: 14 }}>{res.map((b, i) => (
      <li key={i} style={{ display: "block" }}><b>{b.title}</b>{b.author ? ` by ${b.author}` : ""}<div className="sub">{[b.source, b.format, b.license].filter(Boolean).join(" · ")}</div><a className="link" href={b.url} target="_blank" rel="noreferrer">Open page to download</a></li>
    ))}</ul>}
    <p className="note" style={{ marginTop: 12 }}>Downloaded a file? Add it from Upload a Book to listen to it here.</p>
  </>);
}

/* ---------------- Start a group ---------------- */
function NewGroupSheet() {
  const app = useApp();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  async function create() {
    if (name.trim().length < 3) { app.toast("Give the group a name (3 letters or more)"); return; }
    setBusy(true);
    const { data, error } = await supabase.from("groups").insert({ name: name.trim(), description: desc.trim() || null, created_by: app.uid }).select("id,name,description,created_by").single();
    if (error || !data) { setBusy(false); app.toast("Could not create the group"); return; }
    await supabase.from("group_members").insert({ group_id: data.id, user_id: app.uid });
    app.closeSheet(); app.toast("Group created"); app.go("group", data);
  }
  return wrap(app, <>
    <h3>Start a group</h3>
    <input className="field" style={{ margin: "12px 0" }} placeholder="Group name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
    <textarea className="field" rows={3} placeholder="What is it about? (optional)" maxLength={300} value={desc} onChange={(e) => setDesc(e.target.value)} />
    <button className="pill brown wide" style={{ marginTop: 14 }} disabled={busy} onClick={create}>Create group</button>
  </>);
}
