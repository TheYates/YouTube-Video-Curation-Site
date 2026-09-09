import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { getSupabase } from "./supabase"

// Curator allow-list from VITE_ADMIN_EMAILS (comma-separated). Empty means
// NOBODY can enter /admin (fail closed) — fill it in .env.local.
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS ?? "")
  .split(",")
  .map((s: string) => s.trim().toLowerCase())
  .filter(Boolean)

export function isAllowListed(email: string | undefined | null): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

interface AuthState {
  session: Session | null
  user: User | null
  isAdmin: boolean
  loading: boolean
  authReady: boolean
  signInWithGoogle: (next?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  isAdmin: false,
  loading: true,
  authReady: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
})

function safeNextPath(next: string | undefined): string {
  // Only allow relative admin paths back — never an external URL.
  if (next && next.startsWith("/admin/")) return next
  return "/admin/dashboard"
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const sb = getSupabase()

  useEffect(() => {
    if (!sb) {
      setLoading(false)
      return
    }
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [sb])

  const user = session?.user ?? null

  async function signInWithGoogle(next?: string) {
    if (!sb) throw new Error("Supabase is not configured.")
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${safeNextPath(next)}` },
    })
    if (error) throw error
  }

  async function signOut() {
    if (sb) await sb.auth.signOut()
    setSession(null)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isAdmin: isAllowListed(user?.email) && !!session,
        loading,
        authReady: !!sb,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
