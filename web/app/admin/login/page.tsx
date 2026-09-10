"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getBrowserSupabase } from "../../../lib/supabase-browser";
import { signInWithGoogle, signOut } from "../../../lib/auth-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [authReady, setAuthReady] = useState(true);

  const next = searchParams.get("next") ?? "/admin/dashboard";
  const rejected = searchParams.get("rejected") === "1";

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setAuthReady(false);
      setChecking(false);
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      if (data.session) {
        if (rejected) {
          // Signed in but not allow-listed (middleware bounced us): end the
          // session immediately so nothing half-authenticated lingers.
          signOut().then(() => {
            toast.error("That Google account isn't on the admin allow-list.");
            router.replace("/admin/login");
          });
        } else {
          router.replace(next.startsWith("/admin/") ? next : "/admin/dashboard");
        }
      }
      setChecking(false);
    });
  }, [router, next, rejected]);

  async function handleGoogle() {
    setBusy(true);
    try {
      await signInWithGoogle(next);
      // Browser redirects to Google here; no further action.
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Google sign-in failed.");
    }
  }

  if (!authReady) {
    return (
      <p className="text-center text-xs leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
        Supabase isn’t configured (missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).
      </p>
    );
  }
  if (checking) {
    return (
      <p className="text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
        Checking session…
      </p>
    );
  }
  return (
    <>
      {rejected && (
        <p className="rounded-sm border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700">
          Please sign in with an allow-listed curator account.
        </p>
      )}
      <button
        onClick={handleGoogle}
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 rounded-sm border px-4 py-3 text-sm transition-colors hover:bg-[var(--color-muted)] disabled:opacity-50"
        style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z" />
          <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.4 7.5 24 12 24z" />
          <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.7 0 10.2 0 12s.5 3.3 1.4 4.7l3.8-2.3z" />
          <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.6 1.4 6.7l3.8 2.9c1-2.9 3.7-4.9 6.8-4.9z" />
        </svg>
        {busy ? "Redirecting…" : "Continue with Google"}
      </button>
      <Link
        href="/"
        className="block text-center font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-foreground)]"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        ← Back to site
      </Link>
    </>
  );
}

export default function AdminLoginPage() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: "var(--color-background)" }}
    >
      <div
        className="w-full max-w-sm rounded-sm border p-8 space-y-6"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        <div className="text-center space-y-1">
          <p className="font-display text-2xl" style={{ color: "var(--color-foreground)" }}>
            Signal<span style={{ color: "var(--color-accent)" }}>.</span>
          </p>
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Admin sign in
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
