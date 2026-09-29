import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cookie-free, anon-key client for public reads.
//
// Why this exists: awaiting cookies() (which @supabase/ssr's server client
// does) opts an App Router route into dynamic rendering, so `export const
// revalidate` is silently ignored and every request re-renders on the server.
// Google throttles crawl rate on slow hosts, which is how a site ends up with
// "Discovered - currently not indexed" across the board.
//
// Public pages are anonymous anyway — RLS applies the anon role with or
// without a session cookie — so they can share one client and stay
// statically rendered / ISR-cached.
//
// Admin and auth paths must keep using getServerSupabase() from
// ./supabase-server; that one reads cookies deliberately.
let client: SupabaseClient | null = null;

export function getPublicSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — public data cannot be read."
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
