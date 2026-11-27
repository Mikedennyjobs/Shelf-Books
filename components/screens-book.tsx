"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api, fmtDate } from "@/lib/client";
import { useApp } from "@/lib/store";
import { Ref, SHELF_LABEL } from "@/lib/types";
import { Cover, Icon, RateRow, Spinner, Stars } from "./ui";

const SLEEPS = [0, 15, 30, 60];
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

/* ---------------- Book page ---------------- */
export function BookPage({ arg }: { arg: Ref }) {
  const app = useApp();
  const r = arg;
  const row = app.findRow(r);
  const bookId: string | undefined = row?.book_id || r.bookId;
  const sh = row?.shelf as keyof typeof SHELF_LABEL | undefined;
  const busy = app.saving === r.key;
  const [stats, setStats] = useState<any>(null);
  const [marks, setMarks] = useState<any[]>([]);
  const [resolved, setResolved] = useState<string | undefined>(bookId);

  // A search result may already be in the shared library even if this reader has not saved it.
  useEffect(() => {
    (async () => {
      let id = bookId;
      if (!id && r.sourceId) {
        const { data } = await supabase.from("books").select("id").eq("source", r.source).eq("source_id", r.sourceId).maybeSingle();
        id = data?.id;
      }
      setResolved(id);
      if (id) {
        const { data } = await supabase.from("book_stats").select("*").eq("book_id", id).maybeSingle();
        setStats(data);
        const m = await supabase.from("bookmarks").select("id,para_idx,label,created_at").eq("book_id", id).eq("user_id", app.uid).order("para_idx");
        setMarks(m.data || []);
      }
    })();
  }, [r.key, bookId]);

  const p = row?.total ? Math.round((row.idx / row.total) * 100) : 0;
  const voices = [{ id: "", name: "Device voice" }, ...app.narrators];

  async function withId(fn: (id: string) => void) {
    const id = bookId || (await app.ensureSaved(r, "want"));
    if (id) fn(id);
  }
  async function downloadText() {
    await withId(async (id) => {
      const res = await api(`/api/book/${id}`);
      if (!res.ok) { app.toast("Could not download the text."); return; }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url; a.download = `${r.title}.txt`; a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <>
      <div className="bhead">
        <button className="circ" aria-label="Back" onClick={app.back}><Icon n="back" s={26} /></button>
        <button className="circ" aria-label="Share" onClick={() => { navigator.clipboard?.writeText(window.location.origin); app.toast("Link copied. Share it with a friend."); }}><Icon n="share" s={24} /></button>
        <Cover title={r.title} author={r.author} url={r.cover} w={176} />
      </div>
      <div className="bbody">
        <h1 className="btitle">{r.title}</h1>
        <div className="bauth">by {r.author}</div>
        <div className="brate">
          {stats?.ratings > 0 ? (<><Stars n={stats.avg_rating} s={17} /><span>{Number(stats.avg_rating).toFixed(2)} · {stats.ratings} {stats.ratings === 1 ? "rating" : "ratings"} · {stats.listeners} {stats.listeners === 1 ? "listener" : "listeners"}</span></>) : <span>No ratings yet. Be the first to rate it.</span>}
        </div>
      </div>
      <hr />
      <div style={{ padding: "16px 18px" }}>
        <button className="pill green wide" disabled={busy || app.player.loading} onClick={() => app.playBook(r)}>
          {busy || app.player.loading ? <><Spinner /> Preparing the book…</> : <><Icon n="play" s={16} /> {sh === "finished" ? "Listen again" : p > 0 ? `Resume · ${p}%` : "Listen"}</>}
        </button>
        <div className="actions3">
          <button className="pill ghost small" onClick={() => withId((id) => app.openSheet({ type: "ask", bookId: id }))}><Icon n="chat" s={18} /> Ask about a passage</button>
          <button className="pill ghost small" onClick={() => withId((id) => app.openSheet({ type: "record", bookId: id }))}><Icon n="mic" s={18} /> Record a voice</button>
        </div>
      </div>
      <hr />
      <div style={{ padding: "20px 18px", textAlign: "center" }}>
        <button className="pill ghost" style={{ minWidth: 250, fontSize: 19, padding: "14px 20px" }} onClick={() => app.openSheet({ type: "shelf", ref: r })}>
          {sh ? <><Icon n="check" s={20} /> {SHELF_LABEL[sh]}</> : <><Icon n="pencil" s={20} /> Want to Listen</>}
        </button>
        <div className="starsrow"><RateRow value={row?.rating || 0} onRate={(n) => app.rate(r, n)} s={38} /></div>
        <div className="sub" style={{ fontSize: 16 }}>{row?.rating ? "Your rating" : "Rate this book"}</div>
      </div>
      <hr />
      <div className="timeline">
        <p>{sh ? `You marked this book as ${SHELF_LABEL[sh].toLowerCase()} on ${fmtDate(row.added_at)}` : "You have not shelved this book yet"}</p>
        {row?.finished_at && <p>You finished it on {fmtDate(row.finished_at)}</p>}
        {p > 0 && sh !== "finished" && <p>You are {p}% of the way through</p>}
      </div>

      <div className="block">
        <h3>Listen with</h3>
        <div className="row wrap">{voices.map((v) => <button key={v.id || "device"} className={`chip ${app.voiceId === v.id ? "on" : ""}`} onClick={() => app.setVoiceId(v.id)}>{v.name}</button>)}<button className="chip" onClick={() => withId((id) => app.openSheet({ type: "record", bookId: id }))}>+ New voice</button></div>
        <p className="note" style={{ marginTop: 10 }}>Paragraphs recorded in a voice play in that voice. Everything else plays in your device's voice.</p>
      </div>

      {marks.length > 0 && (
        <div className="block"><h3>Bookmarks</h3>
          {marks.map((m) => <button key={m.id} className="opt-row" onClick={() => app.playBook(r, m.para_idx)}><span style={{ fontSize: 15 }}>“{m.label}…”</span><Icon n="play" s={16} /></button>)}
        </div>
      )}

      <div className="block">
        <h3>Get this book</h3>
        <div className="dl">
          {r.epub ? <a href={r.epub} target="_blank" rel="noreferrer" style={{ flex: 1 }}><button style={{ width: "100%" }}><Icon n="download" s={22} />EPUB</button></a> : <button disabled style={{ opacity: .4 }}><Icon n="download" s={22} />EPUB</button>}
          {r.pdf ? <a href={r.pdf} target="_blank" rel="noreferrer" style={{ flex: 1 }}><button style={{ width: "100%" }}><Icon n="download" s={22} />PDF</button></a> : <button disabled style={{ opacity: .4 }}><Icon n="download" s={22} />PDF</button>}
          <button onClick={downloadText}><Icon n="download" s={22} />Text</button>
        </div>
        <div className="legal"><Icon n="shield" s={22} /><span><b>{r.label}</b>. Free to read and download in the United States. Copyright terms differ by country, so check the rules where you live.</span></div>
      </div>

      <div className="block"><h3>About this book</h3><p>{r.summary || (r.subjects?.length ? "Subjects: " + r.subjects.slice(0, 4).join(", ") + "." : "No description is available for this edition.")}</p></div>
      <div className="block">
        <h3>Book Details</h3>
        <div className="kv"><span>Author</span><span>{r.author}{r.authorYears ? ` (${r.authorYears})` : ""}</span></div>
        {r.subjects && r.subjects[0] && <div className="kv"><span>Subject</span><span style={{ textAlign: "right", maxWidth: "60%" }}>{r.subjects[0].replace(/^Category:\s*/i, "")}</span></div>}
        <div className="kv"><span>Source</span><span>{r.label}</span></div>
        <div className="kv"><span>Formats</span><span>Audio, Text{r.epub ? ", EPUB" : ""}{r.pdf ? ", PDF" : ""}</span></div>
      </div>
    </>
  );
}

/* ---------------- Player ---------------- */
export function PlayerScreen() {
  const app = useApp();
  const pl = app.player;
  const row = app.lib.find((x: any) => x.book_id === pl.bookId);
  if (!row) return <div className="player"><div className="ph"><button className="iconbtn" onClick={app.back}><Icon n="down" s={28} /></button><h1>Now Listening</h1><span style={{ width: 38 }} /></div><div className="empty"><Spinner /></div></div>;
  const b = row.books;
  const total = pl.paras.length;
  const pct = total ? Math.round((pl.idx / total) * 100) : 0;
  const voiceName = app.voiceId ? (app.narrators.find((n: any) => n.id === app.voiceId)?.name || "Voice") : "Device voice";
  const show = [pl.idx - 1, pl.idx, pl.idx + 1].filter((i) => i >= 0 && i < total);
  const cycleVoice = () => { const ids = ["", ...app.narrators.map((n: any) => n.id)]; app.setVoiceId(ids[(ids.indexOf(app.voiceId) + 1) % ids.length]); };

  return (
    <div className="player">
      <div className="ph">
        <button className="iconbtn" aria-label="Close player" onClick={() => { pl.stop(); app.refreshStats(); app.back(); }}><Icon n="down" s={28} /></button>
        <h1>Now Listening</h1>
        <button className="iconbtn" aria-label="Features on this screen" onClick={() => app.openSheet({ type: "info" })}><Icon n="info" /></button>
      </div>
      <div className="playbook"><Cover title={b.title} author={b.author} url={b.cover_url} w={64} /><div className="grow"><div className="bt" style={{ fontSize: 18 }}>{b.title}</div><div className="ba">{b.author}</div></div></div>
      <div className="trans">
        {show.map((i) => (
          <div key={i} className={`tp ${i === pl.idx ? "on" : ""}`} onClick={() => pl.jump(i)}>
            {pl.recUrls[i] && <span style={{ marginRight: 6 }}><Icon n="mic" s={14} /></span>}{pl.paras[i]}
          </div>
        ))}
        {!pl.speechOk && <p className="errtxt">This browser blocked speech. Tap play again, or try another browser.</p>}
      </div>
      <div className="scrub">
        <input type="range" min={0} max={Math.max(0, total - 1)} value={pl.idx} aria-label="Position in book"
          onChange={(e) => pl.jump(Number(e.target.value))} />
        <div className="row"><span>Paragraph {pl.idx + 1} of {total}</span><span>{pct}% listened</span></div>
      </div>
      <div className="ctl">
        <button className="iconbtn" style={{ width: 52, height: 52 }} aria-label="Previous paragraph" onClick={() => pl.jump(pl.idx - 1)}><Icon n="prev" s={28} /></button>
        <button className="bigplay" aria-label={pl.playing ? "Pause" : "Play"} onClick={pl.toggle}><Icon n={pl.playing ? "pause" : "play"} s={32} /></button>
        <button className="iconbtn" style={{ width: 52, height: 52 }} aria-label="Next paragraph" onClick={() => pl.jump(pl.idx + 1)}><Icon n="next" s={28} /></button>
      </div>
      <div className="opts">
        <button className="opt" onClick={() => pl.setRate(SPEEDS[(SPEEDS.indexOf(pl.rate) + 1) % SPEEDS.length])}><Icon n="speed" s={18} /> {pl.rate}x</button>
        <button className="opt" onClick={() => { const n = SLEEPS[(SLEEPS.indexOf(pl.sleepMin) + 1) % SLEEPS.length]; pl.setSleepMin(n); app.toast(n ? `Sleep timer: ${n} min` : "Sleep timer off"); }}><Icon n="moon" s={18} /> {pl.sleepMin ? `${pl.sleepMin} min` : "Off"}</button>
        <button className="opt" onClick={cycleVoice}><Icon n="mic" s={18} /> {voiceName}</button>
      </div>
      <div className="opts" style={{ paddingTop: 0 }}>
        <button className="opt" onClick={pl.bookmarkHere}><Icon n="bookmark" s={18} /> Bookmark</button>
        <button className="opt hot" onClick={() => { pl.stop(); app.openSheet({ type: "ask", bookId: pl.bookId }); }}><Icon n="chat" s={18} /> Ask</button>
        <button className="opt hot" onClick={() => { pl.stop(); app.openSheet({ type: "record", bookId: pl.bookId }); }}><Icon n="mic" s={18} /> Record</button>
      </div>
      {pl.ttsVoices.length > 1 && (
        <div style={{ padding: "6px 18px" }}>
          <select className="sel" value={pl.ttsVoice} onChange={(e) => pl.setTtsVoice(e.target.value)} aria-label="Device voice">
            {pl.ttsVoices.map((v: any) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
