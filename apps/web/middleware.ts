import { NextResponse, type NextRequest } from "next/server";

/**
 * Forwards the requested path (+ query) to server components as `x-vitra-path`, so requireUser() and the
 * (app) layout can build an accurate `/login?next=…` redirect. Any client-supplied value is overwritten.
 */
export function middleware(req: NextRequest): NextResponse {
  const headers = new Headers(req.headers);
  headers.set("x-vitra-path", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Pages and route handlers only; static assets do not need the header.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|media/|.*\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)"],
};
