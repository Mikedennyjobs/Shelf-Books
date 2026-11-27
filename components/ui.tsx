"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { Ref, SHELF_LABEL } from "@/lib/types";

const ICONS: Record<string, string> = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  books: '<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M9 4v7l2-1.5 2 1.5V4"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  bell: '<path d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.4"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  down: '<path d="M5 9l7 7 7-7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  share: '<path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 11v9h14v-9"/>',
  play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
  pause: '<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>',
  prev: '<path d="M6 5v14" /><path d="M20 5l-10 7 10 7z" fill="currentColor"/>',
  next: '<path d="M18 5v14"/><path d="M4 5l10 7-10 7z" fill="currentColor"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5"/><path d="M5 20h14"/>',
  upload: '<path d="M12 16V4M8 8l4-4 4 4"/><path d="M5 20h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.5 3.5-7 8-7s8 2.5 8 7"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-4 2.8-6 6.5-6s6.5 2 6.5 6"/><circle cx="17" cy="9" r="2.8"/><path d="M17 14c3 0 4.5 1.8 4.5 5"/>',
  trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0z"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 14v4M8 21h8"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  picks: '<path d="M5 3h11l3 3v15H5z"/><path d="M12 9l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"/>',
  pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  speed: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-5"/>',
  moon: '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 12h8"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
};

export function Icon({ n, s = 24 }: { n: string; s?: number }) {
  return (
    <svg className="ic" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[n] || "" }} />
  );
}

const PAL = [["#B84C5A", "#6E2433"], ["#3E5C6E", "#1F3340"], ["#B8342B", "#5E1713"], ["#4D6B4A", "#1F3320"], ["#6C8B4E", "#32491F"], ["#8A6B3D", "#40301A"], ["#4F8FB5", "#25506B"], ["#C79A3C", "#6E4F12"], ["#7B5EA7", "#3C2862"], ["#2E7D6B", "#154036"]];
const hash = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);

export function Cover({ title, author, url, w = 110 }: { title: string; author?: string; url?: string | null; w?: number }) {
  const [bad, setBad] = useState(false);
  const h = Math.round(w * 1.5);
  if (url && !bad)
    return <img className="coverimg" src={url} alt={title} loading="lazy" onError={() => setBad(true)} style={{ width: w, height: h }} />;
  const c = PAL[hash(title) % PAL.length];
  return (
    <div className="cover" style={{ width: w, height: h, background: `linear-gradient(160deg,${c[0]},${c[1]})` }}>
      <span className="ct" style={{ fontSize: Math.max(9, Math.round(w / 8.5)) }}>{title.length > 60 ? title.slice(0, 58) + "\u2026" : title}</span>
      <span className="ca" style={{ fontSize: Math.max(6.5, Math.round(w / 14)) }}>{author}</span>
    </div>
  );
}

const STAR = "12,3 14.7,9 21,9.6 16.2,14 17.6,20.5 12,17.2 6.4,20.5 7.8,14 3,9.6 9.3,9";
export const Star = ({ on, s = 16 }: { on: boolean; s?: number }) => (
  <svg className="st" width={s} height={s} viewBox="0 0 24 24"><polygon points={STAR} fill={on ? "#E6623F" : "none"} stroke={on ? "#E6623F" : "#8a857c"} strokeWidth={1.6} strokeLinejoin="round" /></svg>
);
export const Stars = ({ n, s = 16 }: { n: number; s?: number }) => (
  <span className="row" style={{ gap: 2 }}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} on={i <= Math.round(n)} s={s} />)}</span>
);
export const RateRow = ({ value, onRate, s = 26 }: { value: number; onRate: (n: number) => void; s?: number }) => (
  <div className="rate-big">{[1, 2, 3, 4, 5].map((i) => <button key={i} aria-label={`${i} stars`} onClick={() => onRate(i)}><Star on={i <= value} s={s} /></button>)}</div>
);

export const Spinner = () => <span className="spin" />;
export const Empty = ({ text, btn, onClick }: { text: string; btn?: string; onClick?: () => void }) => (
  <div className="empty"><p>{text}</p>{btn && <button className="pill brown" onClick={onClick}>{btn}</button>}</div>
);

export function TopBar() {
  const app = useApp();
  return (
    <div className="topbar">
      <div className="pill-search" onClick={() => app.setTab("search")}><Icon n="search" /><span>Title, author or ISBN</span><Icon n="scan" /></div>
      <button className="iconbtn" aria-label="Notifications" onClick={() => app.openSheet({ type: "bell" })} style={{ position: "relative" }}>
        <Icon n="bell" s={26} />
        {app.requests > 0 && <i style={{ position: "absolute", top: 6, right: 6, width: 10, height: 10, borderRadius: 5, background: "#E6623F" }} />}
      </button>
      <button className="iconbtn" aria-label="Features on this screen" onClick={() => app.openSheet({ type: "info" })}><Icon n="info" /></button>
    </div>
  );
}
export function SubHead({ title }: { title: string }) {
  const app = useApp();
  return (
    <div className="subhead">
      <button className="iconbtn" aria-label="Back" onClick={app.back}><Icon n="back" s={26} /></button>
      <h1>{title}</h1>
      <button className="iconbtn" aria-label="Features on this screen" onClick={() => app.openSheet({ type: "info" })}><Icon n="info" /></button>
    </div>
  );
}
export const Head = ({ title, onClick }: { title: string; onClick?: () => void }) => (
  <h2 className="h2" onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}><span>{title}</span>{onClick && <Icon n="chev" s={22} />}</h2>
);

export function SplitBtn({ r }: { r: Ref }) {
  const app = useApp();
  const sh = app.shelfOf(r);
  const busy = app.saving === r.key;
  const open = () => app.openSheet({ type: "shelf", ref: r });
  if (sh)
    return (
      <div className="split">
        <button onClick={open}><Icon n="check" s={16} /></button>
        <button onClick={open}>{SHELF_LABEL[sh as keyof typeof SHELF_LABEL]}</button>
        <button onClick={open}><Icon n="down" s={16} /></button>
      </div>
    );
  return (
    <div className="split">
      <button disabled={busy} onClick={() => app.setShelf(r, "want")}>{busy ? "Saving\u2026" : "Want to Listen"}</button>
      <button onClick={open}><Icon n="down" s={16} /></button>
    </div>
  );
}

export function BookRow({ r, src }: { r: Ref; src?: boolean }) {
  const app = useApp();
  const row = app.findRow(r);
  const open = () => app.go("book", r);
  return (
    <div className="brow">
      <div onClick={open}><Cover title={r.title} author={r.author} url={r.cover} w={66} /></div>
      <div className="grow" onClick={open}>
        <div className="bt" style={{ fontSize: 18 }}>{r.title}</div>
        <div className="ba">by {r.author}</div>
        {src && <span className="badge">{r.label} · free</span>}
        {row?.shelf === "listening" && <><div className="pbar"><i style={{ width: `${row.total ? Math.round((row.idx / row.total) * 100) : 0}%` }} /></div><div className="sub">{row.total ? Math.round((row.idx / row.total) * 100) : 0}% listened</div></>}
        {row?.shelf === "finished" && <div className="meta" style={{ marginTop: 8 }}><Stars n={row.rating || 0} s={14} /></div>}
      </div>
      <div className="act"><SplitBtn r={r} /></div>
    </div>
  );
}

export function Carousel({ refs }: { refs: Ref[] }) {
  const app = useApp();
  return (
    <div className="hscroll">
      {refs.map((r) => (
        <div className="hitem" key={r.key} onClick={() => app.go("book", r)}>
          <Cover title={r.title} author={r.author} url={r.cover} w={110} />
          <div className="t">{r.title}</div>
        </div>
      ))}
    </div>
  );
}

export const Toggle = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
  <button className={`tog ${on ? "on" : ""}`} onClick={onClick} aria-label={label}><i /></button>
);
