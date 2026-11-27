"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api, timeAgo } from "@/lib/client";
import { useApp } from "@/lib/store";
import { refFromBook, refFromCand, GENRES, MORE_GENRES, Ref } from "@/lib/types";
import { BookRow, Carousel, Cover, Empty, Head, Icon, RateRow, Spinner, SplitBtn, Stars, SubHead, TopBar } from "./ui";

/* ---------------- Home ---------------- */
export function Home() {
  const app = useApp();
  const cur = app.lib.filter((r: any) => r.shelf === "listening");
  const saved = app.lib.filter((r: any) => r.shelf !== "listening").slice(0, 8).map((r: any) => refFromBook(r.books));
  const [feed, setFeed] = useState<any[] | null>(null);
  useEffect(() => {
    supabase.from("activity").select("id,type,rating,created_at,user_id,profiles(display_name),books(*)")
      .neq("user_id", app.uid).order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => setFeed((data || []).filter((a: any) => a.books)));
  }, []);
  const slug = `yearly-${new Date().getFullYear()}`;
  const joined = app.stats?.joined?.find((m: any) => m.slug === slug);
  const goal = joined?.goal || 24;
  const done = app.stats?.progress?.[slug] || 0;

  return (
    <>
      <TopBar />
      <section className="sec">
        <Head title="Currently Listening" />
        {cur.length === 0 && <Empty text="Nothing playing yet." btn="Find a book" onClick={() => app.setTab("search")} />}
        {cur.map((row: any) => {
          const r = refFromBook(row.books);
          const p = row.total ? Math.round((row.idx / row.total) * 100) : 0;
          return (
            <div className="curcard" key={row.book_id}>
              <div onClick={() => app.go("book", r)}><Cover title={r.title} author={r.author} url={r.cover} w={84} /></div>
              <div className="grow">
                <div onClick={() => app.go("book", r)}><div className="bt" style={{ fontSize: 18 }}>{r.title}</div><div className="ba">{r.author}</div></div>
                <div className="pbar"><i style={{ width: `${p}%` }} /></div>
                <div className="sub">{p}% listened</div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="pill green small" onClick={() => app.playBook(r)}><Icon n="play" s={14} /> Resume</button>
                  <button className="pill ghost small" onClick={() => app.openSheet({ type: "ask", bookId: row.book_id })}><Icon n="chat" s={16} /> Ask</button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="sec">
        <Head title={`${new Date().getFullYear()} Listening Challenge`} onClick={() => app.go("challenges")} />
        <div className="panel" style={{ margin: 0, display: "flex", gap: 14, alignItems: "center" }} onClick={() => app.go("challenges")}>
          {joined ? (
            <>
              <div className="ring" style={{ ["--p" as any]: `${Math.min(100, Math.round((done / goal) * 100))}%` }}><i>{done}/{goal}</i></div>
              <div className="grow"><b>{done} of {goal} books</b><div className="sub" style={{ marginTop: 4 }}>Finishing a book adds to your total.</div></div>
            </>
          ) : (
            <div className="grow"><b>Set a goal for the year</b><div className="sub" style={{ marginTop: 4 }}>Pick how many books you want to finish.</div></div>
          )}
        </div>
      </section>

      <section className="sec">
        <Head title="Friend activity" onClick={() => app.go("friends")} />
        {feed === null && <Spinner />}
        {feed && feed.length === 0 && <Empty text="Add friends to see what they are listening to." btn="Add friends" onClick={() => app.go("friends")} />}
        {feed && feed.map((a: any) => {
          const r = refFromBook(a.books);
          const verb = a.type === "finished" ? "finished" : a.type === "started" ? "started" : "rated";
          return (
            <div className="panel" style={{ margin: "0 0 12px" }} key={a.id}>
              <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
                <div className="circle" style={{ width: 42, height: 42, fontWeight: 700 }}>{(a.profiles?.display_name || "?")[0].toUpperCase()}</div>
                <div className="grow">
                  <div><b>{a.profiles?.display_name}</b> {verb} <span className="link" onClick={() => app.go("book", r)}>{r.title}</span></div>
                  {a.type === "rated" && <div className="meta" style={{ margin: "6px 0" }}><Stars n={a.rating || 0} s={14} /></div>}
                  <div className="sub" style={{ marginTop: 6 }}>{timeAgo(a.created_at)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {saved.length > 0 && (
        <section className="sec"><Head title="Saved to your library" onClick={() => app.setTab("mybooks")} /><Carousel refs={saved} /></section>
      )}
    </>
  );
}

/* ---------------- My Books ---------------- */
export function MyBooks() {
  const app = useApp();
  const f = app.filter;
  const by = (s: string) => app.lib.filter((r: any) => r.shelf === s);
  const lists: any = { all: app.lib, listening: by("listening"), want: by("want"), finished: by("finished") };
  const chip = (k: string, l: string) => <button key={k} className={`chip ${f === k ? "on" : ""}`} onClick={() => app.setFilter(k)}>{l} {lists[k].length}</button>;
  return (
    <>
      <TopBar />
      <div className="chips" style={{ top: 64 }}>{chip("all", "All")}{chip("listening", "Currently Listening")}{chip("want", "Want to Listen")}{chip("finished", "Finished")}</div>
      <div className="row" style={{ justifyContent: "space-between", padding: "12px 16px" }}><span className="sub">Sorted by: Recently updated</span><span className="sub">{lists[f].length} books</span></div>
      {lists[f].length === 0 ? <Empty text="This shelf is empty." btn="Find a book" onClick={() => app.setTab("search")} /> : lists[f].map((r: any) => <BookRow key={r.book_id} r={refFromBook(r.books)} />)}
    </>
  );
}

/* ---------------- Discover ---------------- */
export function Discover() {
  const app = useApp();
  const [d, setD] = useState<any>(null);
  const [pop, setPop] = useState<{ g: string; c: any }[]>([]);
  useEffect(() => {
    api("/api/discover").then((r) => r.json()).then(setD).catch(() => setD({ popular: [], rows: [] }));
    Promise.all([["Philosophy", "philosophy"], ["Self-Help", "success"]].map(([g, t]) =>
      fetch(`/api/search?topic=${encodeURIComponent(t)}`).then((r) => r.json()).then((x) => ({ g, c: x.results?.[0] })).catch(() => ({ g, c: null }))
    )).then((r) => setPop(r.filter((x) => x.c)));
  }, []);
  if (!d) return <><TopBar /><div className="empty"><Spinner /></div></>;
  const popular: any[] = d.popular || [];
  return (
    <>
      <TopBar />
      {popular.length > 0 && (
        <div className="hero" style={{ cursor: "pointer" }} onClick={() => app.go("collection", { title: "Popular free classics", items: popular })}>
          <div className="collage">{popular.slice(0, 4).map((c) => <Cover key={c.sourceId} title={c.title} author={c.author} url={c.cover} w={84} />)}</div>
          <div className="herocard"><h3 className="serif">Popular free classics</h3><div className="sub">{popular.length} books, all free to read</div></div>
        </div>
      )}
      {(d.rows || []).map((row: any) => (
        <section className="sec" style={{ paddingTop: 26 }} key={row.key}>
          <Head title={row.title} onClick={() => app.go("collection", { title: row.title, items: row.items })} />
          <Carousel refs={row.items.map(refFromCand)} />
        </section>
      ))}
      {pop.map(({ g, c }) => {
        const r = refFromCand(c);
        return (
          <div className="card" key={g}>
            <div className="head">Popular in <b>{g}</b></div>
            <div className="popular">
              <div onClick={() => app.go("book", r)}><Cover title={r.title} author={r.author} url={r.cover} w={92} /></div>
              <div className="grow"><div className="bt" onClick={() => app.go("book", r)}>{r.title}</div><div className="ba" style={{ margin: "6px 0 14px" }}>by {r.author}</div><SplitBtn r={r} /></div>
            </div>
            <div className="row" style={{ marginTop: 14, gap: 10 }}><span style={{ color: "var(--gray)", fontSize: 15 }}>Rate this book:</span><RateRow value={app.findRow(r)?.rating || 0} onRate={(n) => app.rate(r, n)} s={20} /></div>
          </div>
        );
      })}
      {popular.length > 4 && <section className="sec"><Head title="More to start with" /><Carousel refs={popular.slice(4, 14).map(refFromCand)} /></section>}
    </>
  );
}

/* ---------------- Search ---------------- */
function Tools() {
  const app = useApp();
  return (
    <div style={{ padding: "12px 0 4px" }}>
      <button className="srccard" onClick={() => app.openSheet({ type: "scout" })}><div className="circle"><Icon n="globe" s={22} /></div><div><b>Scout the web with Claude</b><span>Looks for official free copies beyond these libraries. Never returns pirate sites.</span></div></button>
      <button className="srccard" onClick={() => app.go("upload")}><div className="circle"><Icon n="upload" s={22} /></div><div><b>Add your own EPUB, PDF or TXT</b><span>Private to you. Text is extracted so it can be read aloud.</span></div></button>
    </div>
  );
}

export function Search() {
  const app = useApp();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [src, setSrc] = useState("all");
  const [all, setAll] = useState(false);
  useEffect(() => {
    const t = q.trim();
    if (!t) { setRes(null); setBusy(false); return; }
    setBusy(true);
    const h = setTimeout(async () => {
      try { const r = await fetch(`/api/search?q=${encodeURIComponent(t)}`); const d = await r.json(); setRes(d.results || []); }
      catch { setRes([]); }
      setBusy(false);
    }, 450);
    return () => clearTimeout(h);
  }, [q]);
  const shown = (res || []).filter((c) => src === "all" || c.label.startsWith(src));
  return (
    <>
      <div className="topbar">
        <div className="pill-search"><Icon n="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, author or ISBN" autoComplete="off" /><Icon n="scan" /></div>
        <button className="iconbtn" aria-label="Notifications" onClick={() => app.openSheet({ type: "bell" })}><Icon n="bell" s={26} /></button>
        <button className="iconbtn" aria-label="Features on this screen" onClick={() => app.openSheet({ type: "info" })}><Icon n="info" /></button>
      </div>
      {!q.trim() ? (
        <>
          <div className="caps">Explore popular genres</div>
          <div className="genres">{GENRES.map((g) => <button key={g.name} className="genre" style={{ background: `linear-gradient(135deg,${g.a},${g.b})` }} onClick={() => app.go("genre", g)}>{g.name}</button>)}</div>
          <button className="outline" onClick={() => setAll(!all)}>{all ? "Show fewer genres" : "Explore all genres"}</button>
          {all && <div className="alllist">{MORE_GENRES.map((g) => <button key={g.name} onClick={() => app.go("genre", g)}><span>{g.name}</span><Icon n="chev" s={20} /></button>)}</div>}
          <div className="caps" style={{ fontSize: 17 }}>Other ways to add books</div>
          <Tools />
        </>
      ) : (
        <>
          <div className="chips" style={{ top: 64 }}>{[["all", "All sources"], ["Project Gutenberg", "Project Gutenberg"], ["Internet Archive", "Internet Archive"]].map(([k, l]) => <button key={k} className={`chip ${src === k ? "on" : ""}`} onClick={() => setSrc(k)}>{l}</button>)}</div>
          {busy && <div className="empty"><Spinner /></div>}
          {!busy && res && shown.length === 0 && <div className="empty"><p>No free edition of “{q}” in these libraries.</p><p className="sub">Recent books are usually still under copyright. Try the web scout.</p></div>}
          {!busy && shown.length > 0 && <div className="sub" style={{ padding: "12px 16px" }}>{shown.length} free editions found</div>}
          {!busy && shown.map((c) => <BookRow key={c.source + c.sourceId} r={refFromCand(c)} src />)}
          <Tools />
        </>
      )}
    </>
  );
}

/* ---------------- Genre, collection, picks ---------------- */
export function Genre({ arg }: { arg: { name: string; topic: string } }) {
  const [res, setRes] = useState<any[] | null>(null);
  useEffect(() => { fetch(`/api/search?topic=${encodeURIComponent(arg.topic)}`).then((r) => r.json()).then((d) => setRes(d.results || [])).catch(() => setRes([])); }, [arg.topic]);
  return (
    <>
      <SubHead title={arg.name} />
      {res === null ? <div className="empty"><Spinner /></div> : res.length === 0 ? <Empty text={`No ${arg.name} titles came back. Try again in a moment.`} /> : (
        <><div className="sub" style={{ padding: "12px 16px" }}>{res.length} free books, most popular first</div>{res.map((c) => <BookRow key={c.source + c.sourceId} r={refFromCand(c)} src />)}</>
      )}
    </>
  );
}

export function Collection({ arg }: { arg: { title: string; items: any[] } }) {
  return (
    <>
      <SubHead title="List" />
      <div style={{ padding: "18px 16px 8px" }}><h2 className="serif" style={{ margin: "0 0 6px", fontSize: 26, lineHeight: 1.2 }}>{arg.title}</h2><div className="sub">{arg.items.length} books</div></div>
      {arg.items.map((c) => <BookRow key={c.source + c.sourceId} r={refFromCand(c)} src />)}
    </>
  );
}

export function Picks() {
  const app = useApp();
  const [d, setD] = useState<any>(null);
  useEffect(() => { api("/api/discover").then((r) => r.json()).then(setD).catch(() => setD({ rows: [], popular: [] })); }, []);
  if (!d) return <><SubHead title="Top picks for you" /><div className="empty"><Spinner /></div></>;
  const picks: { c: any; why: string }[] = [];
  (d.rows || []).forEach((row: any) => row.items.slice(0, 4).forEach((c: any) => picks.push({ c, why: row.title })));
  (d.popular || []).slice(0, picks.length ? 3 : 8).forEach((c: any) => picks.push({ c, why: "Popular with listeners" }));
  return (
    <>
      <SubHead title="Top picks for you" />
      {picks.map(({ c, why }) => {
        const r = refFromCand(c);
        return (
          <div className="brow" key={c.sourceId + why}>
            <div onClick={() => app.go("book", r)}><Cover title={r.title} author={r.author} url={r.cover} w={66} /></div>
            <div className="grow" onClick={() => app.go("book", r)}><div className="bt" style={{ fontSize: 18 }}>{r.title}</div><div className="ba">by {r.author}</div><div className="badge" style={{ background: "#EAF3EE", color: "#245C43" }}>{why}</div></div>
            <div className="act"><SplitBtn r={r} /></div>
          </div>
        );
      })}
    </>
  );
}
