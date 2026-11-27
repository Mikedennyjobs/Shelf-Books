import { supabase } from "./supabase";

export async function api(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  return fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}`, ...(init.headers || {}) },
  });
}

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

export const timeAgo = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

export const initials = (name = "") => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
