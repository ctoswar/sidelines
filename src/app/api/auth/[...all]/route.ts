// Better Auth catch-all handler.
//
// Everything under /api/auth/* — sign-in, sign-out, get-session, sign-up —
// is served from here. Route handlers are Node runtime by default, which is
// what the Drizzle/Postgres driver needs.

import { auth } from "@/server/auth";

const handler = auth.handler;

export { handler as GET, handler as POST };
