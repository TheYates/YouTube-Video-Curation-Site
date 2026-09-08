import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { SUPABASE_URL, SUPABASE_ANON_KEY, USE_SUPABASE } from "./env"

let client: SupabaseClient | null = null

// Returns null when Supabase env vars are not set — callers fall back to
// mock data. No project URL or key is hardcoded here; both come from env.
export function getSupabase(): SupabaseClient | null {
  if (!USE_SUPABASE) return null
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return client
}
