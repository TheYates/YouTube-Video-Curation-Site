import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Edge gate for everything under /admin (except /admin/login itself).
// Fail closed: no session, or a session whose email isn't on ADMIN_EMAILS,
// bounces to the login page. The login page signs rejected sessions out.
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const allowList = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const res = NextResponse.next();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) =>
          toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    }
  );
  const {
    data: { user },
  } = await sb.auth.getUser();

  const email = user?.email?.toLowerCase() ?? "";
  if (!user || !allowList.includes(email)) {
    const login = req.nextUrl.clone();
    login.pathname = "/admin/login";
    login.searchParams.set("next", pathname + search);
    if (user) login.searchParams.set("rejected", "1");
    return NextResponse.redirect(login);
  }
  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};
