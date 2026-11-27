"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { timeAgo } from "@/lib/client";
import { useApp } from "@/lib/store";
import { Empty, Icon, Spinner, SubHead } from "./ui";

/* ---------------- Friends ---------------- */
export function Friends() {
  const app = useApp();
  const [rows, setRows] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<any[] | null>(null);
  const [now, setNow] = useState<Record<string, string>>({});

  async function load() {
    const { data } = await supabase.from("friendships")
      .select("id,status,requester,addressee,rp:profiles!friendships_requester_fkey(id,display_name,username),ap:profiles!friendships_addressee_fkey(id,display_name,username)")
      .or(`requester.eq.${app.uid},addressee.eq.${app.uid}`);
    const list = (data || []).map((f: any) => ({ ...f, other: f.requester === app.uid ? f.ap : f.rp, mine: f.requester === app.uid }));
    setRows(list);
    const ids = list.filter((f: any) => f.status === "accepted").map((f: any) => f.other?.id).filter(Boolean);
    if (ids.length) {
      const l = await supabase.from("library").select("user_id,updated_at,books(title)").in("user_id", ids).eq("shelf", "listening").order("updated_at", { ascending: false });
      const m: Record<string, string> = {};
      (l.data || []).forEach((x: any) => { if (!m[x.user_id] && x.books) m[x.user_id] = x.books.title; });
      setNow(m);
    }
    app.refreshRequests();
  }
  useEffect(() => { load(); }, []);

  async function search() {
    const t = q.trim().replace(/[,()%]/g, "");
    if (t.length < 2) return;
    const { data } = await supabase.from("profiles").select("id,display_name,username").or(`username.ilike.%${t}%,display_name.ilike.%${t}%`).neq("id", app.uid).limit(10);
    setFound(data || []);
  }
  async function add(id: string) {
    const { error } = await supabase.from("friendships").insert({ requester: app.uid, addressee: id });
    app.toast(error ? "Already connected or requested" : "Friend request sent");
    load();
  }
  async function accept(id: string) { await supabase.from("friendships").update({ status: "accepted" }).eq("id", id); app.toast("Friend added"); load(); }
  async function remove(id: string) { await supabase.from("friendships").delete().eq("id", id); load(); }

  const link = typeof window !== "undefined" && app.profile ? `${window.location.origin}/?invite=${app.profile.username}` : "";
  const friends = (rows || []).filter((f) => f.status === "accepted");
  const incoming = (rows || []).filter((f) => f.status === "pending" && !f.mine);
  const outgoing = (rows || []).filter((f) => f.status === "pending" && f.mine);
  const known = new Set((rows || []).map((f) => f.other?.id));

  return (
    <>
      <SubHead title="Add Friends" />
      <div style={{ padding: "14px 16px" }}>
        <div className="inputrow"><input className="field" placeholder="Find friends by name or username" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} /><button className="pill brown small" onClick={search}>Find</button></div>
        <button className="pill brown wide" style={{ marginTop: 12 }} onClick={() => { navigator.clipboard?.writeText(link); app.toast("Invite link copied"); }}><Icon n="share" s={18} /> Copy my invite link</button>
      </div>
      {found && (
        <>
          <div className="sethead">Results</div>
          {found.length === 0 && <p className="note" style={{ padding: "0 16px" }}>Nobody found. Check the spelling or share your invite link.</p>}
          {found.map((p) => (
            <div className="person" key={p.id}><div className="av">{p.display_name[0].toUpperCase()}</div><div className="grow"><b>{p.display_name}</b><div className="sub">@{p.username}</div></div>
              {known.has(p.id) ? <span className="sub">Connected</span> : <button className="pill ghost small" onClick={() => add(p.id)}>Add</button>}</div>
          ))}
        </>
      )}
      {rows === null && <div className="empty"><Spinner /></div>}
      {incoming.length > 0 && <><div className="sethead">Requests</div>{incoming.map((f) => (
        <div className="person" key={f.id}><div className="av">{f.other.display_name[0].toUpperCase()}</div><div className="grow"><b>{f.other.display_name}</b><div className="sub">@{f.other.username}</div></div><button className="pill green small" onClick={() => accept(f.id)}>Accept</button><button className="linkbtn" onClick={() => remove(f.id)}>Decline</button></div>
      ))}</>}
      <div className="sethead">Your friends</div>
      {rows && friends.length === 0 && <Empty text="No friends yet. Share your invite link to get started." />}
      {friends.map((f) => (
        <div className="person" key={f.id}><div className="av">{f.other.display_name[0].toUpperCase()}</div><div className="grow"><b>{f.other.display_name}</b><div className="sub">{now[f.other.id] ? `Listening to ${now[f.other.id]}` : `@${f.other.username}`}</div></div><button className="linkbtn" onClick={() => { if (confirm(`Remove ${f.other.display_name}?`)) remove(f.id); }}>Remove</button></div>
      ))}
      {outgoing.length > 0 && <><div className="sethead">Sent</div>{outgoing.map((f) => <div className="person" key={f.id}><div className="av">{f.other.display_name[0].toUpperCase()}</div><div className="grow"><b>{f.other.display_name}</b><div className="sub">Waiting for them to accept</div></div><button className="linkbtn" onClick={() => remove(f.id)}>Cancel</button></div>)}</>}
      <p className="note" style={{ padding: "14px 16px" }}>Friends only see what you start, finish and rate, and only if sharing is on in Settings. Your voices and uploads are never shared.</p>
    </>
  );
}

/* ---------------- Groups ---------------- */
export function Groups() {
  const app = useApp();
  const [groups, setGroups] = useState<any[] | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());
  async function load() {
    const g = await supabase.from("groups").select("id,name,description,created_by,group_members(count)").order("created_at");
    const m = await supabase.from("group_members").select("group_id").eq("user_id", app.uid);
    setGroups(g.data || []);
    setMine(new Set((m.data || []).map((x: any) => x.group_id)));
  }
  useEffect(() => { load(); }, [app.sheet]);
  async function toggle(id: string) {
    if (mine.has(id)) await supabase.from("group_members").delete().eq("group_id", id).eq("user_id", app.uid);
    else await supabase.from("group_members").insert({ group_id: id, user_id: app.uid });
    app.toast(mine.has(id) ? "Left the group" : "Joined");
    load();
  }
  return (
    <>
      <SubHead title="Groups" />
      {groups === null && <div className="empty"><Spinner /></div>}
      {groups?.map((g) => (
        <div className="panel" key={g.id}>
          <div className="row" style={{ gap: 12, alignItems: "flex-start" }} onClick={() => app.go("group", g)}>
            <div className="circle"><Icon n="users" s={22} /></div>
            <div className="grow"><b style={{ fontSize: 17 }}>{g.name}</b><div className="sub">{g.group_members?.[0]?.count ?? 0} members</div><div style={{ marginTop: 6, fontSize: 14.5, color: "var(--gray)", lineHeight: 1.4 }}>{g.description}</div></div>
          </div>
          <button className={`pill small ${mine.has(g.id) ? "green" : "ghost"}`} style={{ marginTop: 12 }} onClick={() => toggle(g.id)}>{mine.has(g.id) ? "Joined" : "Join group"}</button>
        </div>
      ))}
      <div style={{ padding: "4px 16px 16px" }}><button className="pill brown wide" onClick={() => app.openSheet({ type: "newgroup" })}><Icon n="plus" s={18} /> Start a group</button></div>
    </>
  );
}

export function GroupPage({ arg }: { arg: any }) {
  const app = useApp();
  const [posts, setPosts] = useState<any[] | null>(null);
  const [member, setMember] = useState(false);
  const [body, setBody] = useState("");
  const [count, setCount] = useState<number>(arg.group_members?.[0]?.count ?? 0);
  async function load() {
    const m = await supabase.from("group_members").select("user_id", { count: "exact" }).eq("group_id", arg.id);
    setCount(m.count || 0);
    setMember((m.data || []).some((x: any) => x.user_id === app.uid));
    const p = await supabase.from("group_posts").select("id,body,created_at,user_id,profiles(display_name)").eq("group_id", arg.id).order("created_at", { ascending: false }).limit(60);
    setPosts(p.data || []);
  }
  useEffect(() => { load(); }, [arg.id]);
  async function join() { await supabase.from("group_members").insert({ group_id: arg.id, user_id: app.uid }); app.toast("Joined"); load(); }
  async function leave() { await supabase.from("group_members").delete().eq("group_id", arg.id).eq("user_id", app.uid); app.toast("Left the group"); load(); }
  async function post() {
    const t = body.trim();
    if (!t) return;
    const { error } = await supabase.from("group_posts").insert({ group_id: arg.id, user_id: app.uid, body: t.slice(0, 2000) });
    if (error) { app.toast("Could not post. Join the group first."); return; }
    setBody(""); load();
  }
  async function del(id: string) { await supabase.from("group_posts").delete().eq("id", id); load(); }
  return (
    <>
      <SubHead title="Group" />
      <div style={{ padding: "18px 16px 8px" }}>
        <h2 className="serif" style={{ margin: "0 0 6px", fontSize: 26, lineHeight: 1.2 }}>{arg.name}</h2>
        <div className="sub">{count} members</div>
        <p style={{ color: "var(--gray)", lineHeight: 1.45 }}>{arg.description}</p>
        <button className={`pill small ${member ? "green" : "brown"}`} onClick={member ? leave : join}>{member ? "Joined" : "Join group"}</button>
      </div>
      {member ? (
        <div style={{ padding: "8px 16px 14px" }}>
          <textarea className="field" placeholder="Share a thought with the group" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
          <button className="pill brown small" style={{ marginTop: 8 }} onClick={post} disabled={!body.trim()}>Post</button>
        </div>
      ) : <p className="note" style={{ padding: "0 16px" }}>Join the group to read and write posts.</p>}
      {posts === null && <div className="empty"><Spinner /></div>}
      {member && posts && posts.length === 0 && <Empty text="No posts yet. Start the conversation." />}
      {member && posts?.map((p) => (
        <div className="post" key={p.id}>
          <div className="who"><span>{p.profiles?.display_name}</span><span className="sub" style={{ fontWeight: 400 }}>{timeAgo(p.created_at)}</span></div>
          <p>{p.body}</p>
          {(p.user_id === app.uid || arg.created_by === app.uid) && <button className="linkbtn dangerbtn" style={{ fontSize: 13 }} onClick={() => del(p.id)}>Delete</button>}
        </div>
      ))}
    </>
  );
}
