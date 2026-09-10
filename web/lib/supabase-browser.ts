import { createBrowserClient } from "@supabase/ssr";

// Browser-side client (anon key, RLS applies). Null when env is missing.
//
// Must be the SSR-aware browser client (not plain `createClient`): it stores
// the OAuth PKCE code verifier in cookies so /auth/callback can exchange the
// code for a session server-side. A plain supabase-js client keeps the
// verifier in localStorage, which the server can't read — Google sign-in
// then bounces back to /admin/login with a code-exchange error.
let cached: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anon) return null;
  if (!cached) cached = createBrowserClient(url, anon);
  return cached;
}
