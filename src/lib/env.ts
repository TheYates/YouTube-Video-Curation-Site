export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ""
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ""

// Supabase reads are only attempted when BOTH vars are set.
// Unset either one to run the app on built-in mock data.
export const USE_SUPABASE = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0

// Newsletter (email capture + subscribers admin) is disabled for now —
// no backend exists for it yet. Flip to true to restore the signup forms,
// the admin nav item/route, and the dashboard stat card.
export const NEWSLETTER_ENABLED = false
