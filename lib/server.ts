import { createClient } from "@supabase/supabase-js";

export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

export async function getUser(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token || token === "undefined") return null;
  const { data } = await admin().auth.getUser(token);
  return data.user ?? null;
}

// Only fetch from known free-book hosts (prevents the server being used as an open proxy).
const HOSTS = ["gutenberg.org", "archive.org"];
export const allowed = (u: string) => {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && HOSTS.some((h) => url.hostname === h || url.hostname.endsWith("." + h));
  } catch {
    return false;
  }
};

// Per-user daily cap on AI calls. Returns false when the cap is reached.
export async function underLimit(userId: string) {
  const sb = admin();
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count } = await sb.from("ask_log").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  if ((count ?? 0) >= Number(process.env.DAILY_ASK_LIMIT || 50)) return false;
  await sb.from("ask_log").insert({ user_id: userId });
  return true;
}

export async function claude(body: any) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, ...body }),
  });
  const d = await r.json();
  return (d.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
}
