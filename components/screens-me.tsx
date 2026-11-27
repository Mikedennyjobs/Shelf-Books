"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api, fmtDate, initials } from "@/lib/client";
import { useApp } from "@/lib/store";
import { refFromBook, SHELF_LABEL } from "@/lib/types";
import { Cover, Empty, Icon, Spinner, Stars, SubHead, Toggle } from "./ui";

/* ---------------- My Voices ---------------- */
export function Voices() {
  const app = useApp();
  const [recs, setRecs] = useState<any[] | null>(null);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const load = async () => {
    const { data } = await supabase.from("recordings").select("narrator_id,book_id,books(title)").eq("user_id", app.uid);
    setRecs(data || []);
  };
  useEffect(() => { load(); }, []);

  const lastBook = app.player.bookId || app.lib.find((r: any) => r.shelf === "listening")?.book_id || app.lib[0]?.book_id;
  async function add() {
    if (!name.trim() || !consent) return;
    const { data, error } = await supabase.from("narrators").insert({ user_id: app.uid, name: name.trim() }).select("id").single();
    if (error) { app.toast(error.message); return; }
    await app.refreshNarrators(); app.setVoiceId(data.id); setName(""); setConsent(false); app.toast("Voice saved");
  }
  async function del(id: string) {
    if (!confirm("Delete this voice and all of its recordings? This cannot be undone.")) return;
    await api("/api/rec-delete", { method: "POST", body: JSON.stringify({ narratorId: id }) });
    if (app.voiceId === id) app.setVoiceId("");
    await app.refreshNarrators(); await load(); app.toast("Voice and its recordings deleted");
  }
  return (
    <>
      <SubHead title="My Voices" />
      <div className="panel">
        <h3>Read to me in a voice I love</h3>
        <p className="sub" style={{ lineHeight: 1.45 }}>Record yourself, or someone who agrees, reading a book one paragraph at a time. Those paragraphs then play in that voice.</p>
        <div className="sub" style={{ margin: "12px 0 6px" }}>Whose voice is this?</div>
        <input className="field" placeholder="A name, for example Me or Amara" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>This is my own voice, or the person has agreed to be recorded and to have their voice used to read books. It can be deleted at any time.</span></label>
        <button className="pill brown wide" disabled={!name.trim() || !consent} onClick={add}>Add voice</button>
      </div>
      {recs === null && <div className="empty"><Spinner /></div>}
      {app.narrators.map((n: any) => {
        const mine = (recs || []).filter((x) => x.narrator_id === n.id);
        const perBook: Record<string, { t: string; c: number }> = {};
        mine.forEach((x) => { perBook[x.book_id] = perBook[x.book_id] || { t: x.books?.title || "Book", c: 0 }; perBook[x.book_id].c++; });
        return (
          <div className="panel" key={n.id}>
            <div className="row" style={{ gap: 12 }}><div className="circle"><Icon n="mic" s={22} /></div><div className="grow"><b style={{ fontSize: 18 }}>{n.name}</b><div className="sub">Consent confirmed {fmtDate(n.consent_at)}</div></div></div>
            <div className="kv" style={{ marginTop: 10 }}><span>Paragraphs recorded</span><span>{mine.length}</span></div>
            {Object.values(perBook).map((b) => <div className="kv" key={b.t}><span>{b.t}</span><span>{b.c} paragraphs</span></div>)}
            <div className="row wrap" style={{ marginTop: 14 }}>
              <button className={`pill small ${app.voiceId === n.id ? "green" : "ghost"}`} onClick={() => { app.setVoiceId(app.voiceId === n.id ? "" : n.id); }}>{app.voiceId === n.id ? "Listening with this voice" : "Listen with this voice"}</button>
              <button className="pill ghost small" onClick={() => { if (!lastBook) { app.toast("Open a book first, then tap Record a voice."); return; } app.setVoiceId(n.id); app.openSheet({ type: "record", bookId: lastBook }); }}>Record more</button>
              <button className="linkbtn dangerbtn" style={{ marginLeft: "auto" }} onClick={() => del(n.id)}>Delete</button>
            </div>
          </div>
        );
      })}
      <div className="panel"><div className="row" style={{ gap: 12, alignItems: "flex-start" }}><Icon n="lock" s={22} /><p className="sub" style={{ margin: 0, lineHeight: 1.45 }}>Voices and recordings are private to your account and are never shared with friends or groups. Deleting a voice removes every recording in it. Recordings use about 0.3 MB per minute.</p></div></div>
    </>
  );
}

/* ---------------- Upload ---------------- */
export function Upload() {
  const app = useApp();
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setMsg("Uploading and reading your file…");
    try {
      const u = await (await api("/api/upload-url", { method: "POST", body: JSON.stringify({ filename: f.name }) })).json();
      if (u.error) throw new Error(u.error);
      const up = await supabase.storage.from("books").uploadToSignedUrl(u.path, u.token, f);
      if (up.error) throw new Error(up.error.message);
      const r = await api("/api/ingest", { method: "POST", body: JSON.stringify({ path: u.path, title: f.name }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await app.refreshLib();
      app.toast("Added to Want to Listen");
      app.setFilter("want"); app.setTab("mybooks");
    } catch (err: any) { setMsg(err.message || "Could not add that file."); }
    setBusy(false); e.target.value = "";
  }
  return (
    <>
      <SubHead title="Upload a Book" />
      <div className="panel" style={{ textAlign: "center", padding: "28px 16px" }}>
        <div className="circle" style={{ margin: "0 auto 12px", width: 64, height: 64 }}><Icon n="upload" s={30} /></div>
        <h3>Add a book you own</h3>
        <p className="sub" style={{ lineHeight: 1.45, marginBottom: 14 }}>EPUB, PDF or plain text files. We pull out the text so it can be read aloud.</p>
        <input ref={ref} type="file" accept=".txt,.epub,.pdf" style={{ display: "none" }} onChange={onFile} />
        <button className="pill brown" disabled={busy} onClick={() => ref.current?.click()}>{busy ? <><Spinner /> Working…</> : "Choose a file"}</button>
        {msg && <p className={busy ? "sub" : "errtxt"} style={{ marginTop: 12 }}>{msg}</p>}
      </div>
      <div className="panel"><h3>Good to know</h3><ul className="flist"><li>Uploads are private. Nobody else can see or use them.</li><li>Text-based PDFs work. Scanned pages (pictures of text) are rejected with a clear message.</li><li>Your place and your recordings are saved like any other book.</li><li>Large files upload directly, so they will not time out.</li></ul></div>
    </>
  );
}

/* ---------------- Ask history ---------------- */
export function AskHistory() {
  const app = useApp();
  const [rows, setRows] = useState<any[] | null>(null);
  const load = () => supabase.from("ask_history").select("id,question,answer,created_at,books(*)").eq("user_id", app.uid).order("created_at", { ascending: false }).limit(60).then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);
  async function clear() {
    if (!confirm("Clear your whole question history?")) return;
    await supabase.from("ask_history").delete().eq("user_id", app.uid);
    setRows([]);
  }
  return (
    <>
      <SubHead title="Ask History" />
      {rows === null ? <div className="empty"><Spinner /></div> : rows.length === 0 ? <Empty text="Questions you ask while listening will appear here." /> : (
        <>
          {rows.map((q) => {
            const r = q.books ? refFromBook(q.books) : null;
            return (
              <div className="brow" key={q.id} onClick={() => r && app.go("book", r)}>
                {r && <Cover title={r.title} author={r.author} url={r.cover} w={54} />}
                <div className="grow"><div className="sub">{r?.title}</div><div style={{ fontWeight: 600, margin: "4px 0" }}>{q.question}</div><div className="sub" style={{ lineHeight: 1.4 }}>{q.answer.length > 160 ? q.answer.slice(0, 160) + "…" : q.answer}</div></div>
              </div>
            );
          })}
          <div style={{ padding: 16 }}><button className="linkbtn dangerbtn" onClick={clear}>Clear history</button></div>
        </>
      )}
    </>
  );
}

/* ---------------- Profile ---------------- */
export function Profile() {
  const app = useApp();
  const p = app.profile, s = app.stats;
  if (!p) return <><SubHead title="My Profile" /><div className="empty"><Spinner /></div></>;
  const goalSec = (p.daily_goal_min || 20) * 60;
  const todayMin = Math.floor((s?.todaySec || 0) / 60);
  const rated = app.lib.filter((r: any) => r.rating).slice(0, 3);
  const count = (k: string) => app.lib.filter((r: any) => r.shelf === k).length;
  return (
    <>
      <SubHead title="My Profile" />
      <div style={{ textAlign: "center", padding: "22px 16px 8px" }}>
        <div className="avatar" style={{ background: p.avatar_color }}>{initials(p.display_name)}</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{p.display_name}</div>
        <div className="sub">@{p.username} · Listening since {fmtDate(p.created_at)}</div>
      </div>
      <div className="panel"><div className="stat">
        <div><b>{s?.finished ?? "–"}</b><span>Finished</span></div><div><b>{s?.hours ?? "–"}</b><span>Hours</span></div><div><b>{s?.voices ?? "–"}</b><span>Voices</span></div><div><b>{s?.friends ?? "–"}</b><span>Friends</span></div>
      </div></div>
      <div className="panel row" style={{ gap: 14 }}>
        <div className="ring" style={{ ["--p" as any]: `${Math.min(100, Math.round(((s?.todaySec || 0) / goalSec) * 100))}%` }}><i>{todayMin}/{p.daily_goal_min}</i></div>
        <div className="grow"><b>Daily goal: {p.daily_goal_min} minutes</b><div className="sub" style={{ marginTop: 4 }}>{s?.streak ? `${s.streak}-day streak. Keep it going.` : "Listen today to start a streak."}</div></div>
      </div>
      <div className="panel" style={{ padding: "4px 16px" }}>
        <h3 style={{ paddingTop: 12 }}>Shelves</h3>
        {(["listening", "want", "finished"] as const).map((k) => (
          <button key={k} className="opt-row" onClick={() => { app.setFilter(k); app.setTab("mybooks"); }}><span>{SHELF_LABEL[k]}</span><span className="row sub" style={{ gap: 6 }}>{count(k)} <Icon n="chev" s={18} /></span></button>
        ))}
      </div>
      {rated.length > 0 && <div className="panel"><h3>Recent ratings</h3>{rated.map((r: any) => <div key={r.book_id} className="row" style={{ padding: "8px 0", justifyContent: "space-between" }}><span>{r.books.title}</span><Stars n={r.rating} s={14} /></div>)}</div>}
    </>
  );
}

/* ---------------- Challenges ---------------- */
export function Challenges() {
  const app = useApp();
  const s = app.stats;
  const [goal, setGoal] = useState<number | null>(null);
  if (!s) return <><SubHead title="Listening Challenges" /><div className="empty"><Spinner /></div></>;
  const year = new Date().getFullYear();
  const joined = (slug: string) => s.joined.find((m: any) => m.slug === slug);
  async function join(slug: string, g?: number) {
    await supabase.from("challenge_members").insert({ slug, user_id: app.uid, goal: g ?? null });
    await app.refreshStats(); app.toast("Joined");
  }
  async function leave(slug: string) { await supabase.from("challenge_members").delete().eq("slug", slug).eq("user_id", app.uid); await app.refreshStats(); app.toast("Left the challenge"); }
  async function saveGoal(slug: string) {
    if (!goal || goal < 1) return;
    await supabase.from("challenge_members").update({ goal }).eq("slug", slug).eq("user_id", app.uid);
    setGoal(null); await app.refreshStats(); app.toast("Goal updated");
  }
  const yc = s.challenges.find((c: any) => c.slug === `yearly-${year}`);
  const ym = yc && joined(yc.slug);
  const others = s.challenges.filter((c: any) => c.kind !== "books");
  return (
    <>
      <SubHead title="Listening Challenges" />
      {yc && (
        <div className="panel">
          <h3>{yc.title}</h3>
          {ym ? (
            <>
              <div className="row" style={{ gap: 14, margin: "10px 0" }}>
                <div className="ring" style={{ ["--p" as any]: `${Math.min(100, Math.round(((s.progress[yc.slug] || 0) / (ym.goal || yc.target)) * 100))}%` }}><i>{s.progress[yc.slug] || 0}/{ym.goal || yc.target}</i></div>
                <div className="grow"><b>{s.progress[yc.slug] || 0} of {ym.goal || yc.target} books</b><div className="sub" style={{ marginTop: 4 }}>Finish a book to move your total.</div></div>
              </div>
              {goal === null ? <button className="pill ghost small" onClick={() => setGoal(ym.goal || yc.target)}>Edit my goal</button> : (
                <div className="inputrow"><input className="field" type="number" min={1} max={365} value={goal} onChange={(e) => setGoal(Number(e.target.value))} /><button className="pill brown small" onClick={() => saveGoal(yc.slug)}>Save</button></div>
              )}
            </>
          ) : (
            <><p className="sub" style={{ lineHeight: 1.45 }}>Pick how many books you want to finish in {year}.</p><button className="pill brown small" onClick={() => join(yc.slug, 24)}>Start with 24 books</button></>
          )}
        </div>
      )}
      <div className="sethead">Join a challenge</div>
      {others.map((c: any) => {
        const m = joined(c.slug);
        const done = s.progress[c.slug] || 0;
        return (
          <div className="panel" key={c.slug}>
            <div className="row" style={{ gap: 12 }}>
              <div className="circle"><Icon n="trophy" s={22} /></div>
              <div className="grow"><b>{c.title}</b><div className="sub" style={{ marginTop: 2 }}>{c.description}</div>{m && <><div className="pbar"><i style={{ width: `${Math.min(100, Math.round((done / c.target) * 100))}%` }} /></div><div className="sub">{done} of {c.target}</div></>}</div>
              <button className={`pill small ${m ? "green" : "ghost"}`} onClick={() => (m ? leave(c.slug) : join(c.slug))}>{m ? "Joined" : "Join"}</button>
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ---------------- Settings ---------------- */
export function Settings() {
  const app = useApp();
  const p = app.profile;
  const [name, setName] = useState(p?.display_name || "");
  const [user, setUser] = useState(p?.username || "");
  const [err, setErr] = useState("");
  if (!p) return <><SubHead title="Settings" /><div className="empty"><Spinner /></div></>;
  const prefs = p.prefs || {};
  const setPref = (patch: any) => app.updateProfile({ prefs: { ...prefs, ...patch } });
  async function saveName() {
    setErr("");
    const u = user.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!name.trim() || u.length < 3) { setErr("Use a name and a username of at least 3 letters or numbers."); return; }
    const e = await app.updateProfile({ display_name: name.trim(), username: u });
    if (e) setErr(e.message.includes("duplicate") ? "That username is taken." : e.message); else { setUser(u); app.toast("Profile saved"); }
  }
  async function deleteVoices() {
    if (!confirm("Delete every voice and recording you have made?")) return;
    for (const n of app.narrators) await api("/api/rec-delete", { method: "POST", body: JSON.stringify({ narratorId: n.id }) });
    app.setVoiceId(""); await app.refreshNarrators(); app.toast("All voices deleted");
  }
  async function deleteAccount() {
    if (!confirm("Delete your account, shelves, recordings and uploads forever?")) return;
    if (prompt('Type DELETE to confirm') !== "DELETE") return;
    const r = await api("/api/delete-account", { method: "POST" });
    if (r.ok) { await supabase.auth.signOut(); window.location.reload(); } else app.toast("Could not delete the account. Try again.");
  }
  const Row = ({ t, d, children }: any) => <div className="setrow"><div>{t}{d && <small>{d}</small>}</div>{children}</div>;
  return (
    <>
      <SubHead title="Settings" />
      <div className="sethead">Profile</div>
      <div style={{ padding: "8px 16px" }}>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" style={{ marginBottom: 8 }} />
        <input className="field" value={user} onChange={(e) => setUser(e.target.value)} placeholder="Username" />
        {err && <p className="errtxt">{err}</p>}
        <button className="pill brown small" style={{ marginTop: 10 }} onClick={saveName}>Save profile</button>
        <p className="note">Friends find you by username: {typeof window !== "undefined" ? window.location.origin : ""}/?invite={p.username}</p>
      </div>
      <div className="sethead">Listening</div>
      <Row t="Daily goal"><select className="sel" style={{ width: 120 }} value={p.daily_goal_min} onChange={(e) => app.updateProfile({ daily_goal_min: Number(e.target.value) })}>{[10, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}</select></Row>
      <Row t="Default speed"><select className="sel" style={{ width: 120 }} value={prefs.speed || 1} onChange={(e) => { const v = Number(e.target.value); setPref({ speed: v }); app.player.setRate(v); }}>{[0.75, 1, 1.25, 1.5, 2].map((m) => <option key={m} value={m}>{m}x</option>)}</select></Row>
      <Row t="Default voice"><select className="sel" style={{ width: 150 }} value={prefs.voiceId || ""} onChange={(e) => { setPref({ voiceId: e.target.value }); app.setVoiceId(e.target.value); }}><option value="">Device voice</option>{app.narrators.map((n: any) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></Row>
      <div className="sethead">Privacy</div>
      <Row t="Share my activity with friends" d="Friends see what you start, finish and rate. Voices and uploads are never shared."><Toggle on={!!p.share_activity} label="Share activity" onClick={() => app.updateProfile({ share_activity: !p.share_activity })} /></Row>
      <button className="setrow" style={{ width: "100%", textAlign: "left" }} onClick={deleteVoices}><span>Delete all my voices</span></button>
      <div className="sethead">Where books come from</div>
      <Row t="Project Gutenberg" d="Public-domain classics" /><Row t="Internet Archive" d="Public-domain and Creative Commons items only" /><Row t="Claude web scout" d="Official free copies only. Never pirate sites." />
      <div className="sethead">Account</div>
      <Row t="Email" d={app.session.user.email} />
      <button className="setrow" style={{ width: "100%", textAlign: "left" }} onClick={() => supabase.auth.signOut()}><span>Sign out</span></button>
      <button className="setrow dangerbtn" style={{ width: "100%", textAlign: "left" }} onClick={deleteAccount}><span>Delete my account and data</span></button>
    </>
  );
}
