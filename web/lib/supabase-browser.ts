import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Browser-side client (anon key, RLS applies). Null when env is missing.
export function getBrowserSupabase() {
  if (!url || !anon) return null;
  return createClient(url, anon);
}
