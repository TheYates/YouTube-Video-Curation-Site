import { getBrowserSupabase } from "./supabase-browser";

// Browser-side auth helpers for the admin login page and sidebar.
// The edge middleware (middleware.ts) is the real gate; these only drive UI.

function safeNextPath(next: string | undefined): string {
  if (next && next.startsWith("/admin/")) return next;
  return "/admin/dashboard";
}

export async function signInWithGoogle(next?: string): Promise<void> {
  const sb = getBrowserSupabase();
  if (!sb) throw new Error("Supabase is not configured.");
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${safeNextPath(next)}` },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await getBrowserSupabase()?.auth.signOut();
}

export async function getSessionEmail(): Promise<string | null> {
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user?.email ?? null;
}
