"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AppProvider } from "@/lib/store";
import { Shell } from "@/components/Shell";

export default function Page() {
  const [session, setSession] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Keep an invite link alive through the email sign-in round trip.
    const inv = new URLSearchParams(window.location.search).get("invite");
    if (inv) localStorage.setItem("sv_invite", inv);
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="phone"><p className="sub" style={{ padding: 24 }}>Loading…</p></div>;
  if (session) return <AppProvider session={session}><Shell /></AppProvider>;

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const inv = localStorage.getItem("sv_invite");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + (inv ? `/?invite=${encodeURIComponent(inv)}` : "") } });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  }
  return (
    <div className="phone">
      <div style={{ padding: "64px 24px" }}>
        <div className="serif" style={{ fontSize: 30, fontWeight: 700 }}>Shelf Voice</div>
        <p className="sub" style={{ margin: "8px 0 24px", fontSize: 15, lineHeight: 1.45 }}>Free, legal books that read to you. Sign in to keep your shelves and your place in every book.</p>
        {sent ? <p className="ok" style={{ color: "var(--green)" }}>Check your email for the sign-in link.</p> : (
          <form onSubmit={signIn}>
            <input className="field" type="email" required placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="pill brown wide" style={{ marginTop: 12 }} type="submit" disabled={busy}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
            {err && <p style={{ color: "#B3392C", fontSize: 14 }}>{err}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
