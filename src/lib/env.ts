export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ""
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ""

// Supabase reads are only attempted when BOTH vars are set.
// Unset either one to run the app on built-in mock data.
export const USE_SUPABASE = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0
