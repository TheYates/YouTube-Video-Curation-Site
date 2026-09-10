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
  // Land on /auth/callback (NOT the dashboard directly): it exchanges the
  // PKCE code for a session server-side first. Without that step the edge
  // middleware sees no cookies and bounces back to login in a loop.
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`;
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
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
