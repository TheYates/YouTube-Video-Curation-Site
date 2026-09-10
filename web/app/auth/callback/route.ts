import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// OAuth landing pad. Supabase returns here with a PKCE `?code=` after Google
// sign-in; this exchanges it for a session (setting auth cookies server-side)
// BEFORE redirecting into /admin — so the edge middleware sees the session
// on arrival instead of bouncing back to login in a loop.
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  // Return path arrives via cookie (redirect_to must stay a bare URL for
  // reliable allow-list matching); legacy ?next= still honored if present.
  const cookieNext = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === "post_login_next")?.[1];
  const rawNext = searchParams.get("next") ?? (cookieNext ? decodeURIComponent(cookieNext) : "/admin/dashboard");
  const next = rawNext.startsWith("/admin/") ? rawNext : "/admin/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/admin/login?error=no_code`);
  }

  const cookieStore = await cookies();
  const res = NextResponse.redirect(`${origin}${next}`);
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (
          toSet: { name: string; value: string; options: CookieOptions }[]
        ) => {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
            res.cookies.set(name, value, options);
          }
        },
      },
    }
  );
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) {
    console.error(`[auth/callback] code exchange failed: ${error.message}`);
    return NextResponse.redirect(
      `${origin}/admin/login?error=${encodeURIComponent(error.message)}`
    );
  }
  // Single-use return path — clear it.
  res.cookies.set("post_login_next", "", { path: "/", maxAge: 0 });
  return res;
}
