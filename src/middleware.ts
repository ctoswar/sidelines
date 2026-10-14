// Route protection.
//
// Two layers, split by what each runtime can do:
//
//   1. This middleware runs on the edge runtime, where the Postgres driver is
//      unavailable, so it does the cheap check only: does a session cookie
//      exist? Signed-out visitors get a real 302 to /login before any page
//      bytes stream.
//
//   2. The player/organizer layouts call requireRole(), which loads the real
//      session from Postgres and verifies the role. That is the authoritative
//      check — a stray cookie gets you past middleware but not past the
//      layout, which refuses to render the wrong role's workspace.
//
// When the layout rejects a role mismatch it throws Next's redirect(), which
// the router delivers inside the RSC payload rather than as a status code —
// the response streams as 200 but contains no workspace content, and the
// browser navigates the user away immediately. That is standard App Router
// behaviour for redirects thrown during streaming, and it is why the layout
// check runs before any workspace content is composed.
//
// The scoring route (/score/[game]) is deliberately public: QR codes open it
// without an account, and Phase 4 authenticates it with a capability token.

import { NextResponse, type NextRequest } from "next/server";

const WORKSPACE_PREFIXES = ["/player", "/organizer"];

/** Better Auth's cookie name, with the __Secure- prefix it gains over HTTPS. */
const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const inWorkspace = WORKSPACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!inWorkspace) return NextResponse.next();

  const signedIn = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (signedIn) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Run only on the workspaces — never on auth routes, the API, or static
  // assets, where a redirect loop or an extra hop would only hurt.
  matcher: ["/player/:path*", "/organizer/:path*"],
};
