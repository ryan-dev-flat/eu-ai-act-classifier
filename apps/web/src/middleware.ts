import { NextRequest, NextResponse } from 'next/server';
import { readDevSession } from './lib/session';

/**
 * Injects dev auth headers on every /api/* request so the upstream services
 * (running with AUTH_DEV_MODE=true) accept the call. This will be replaced
 * with cookie/JWT exchange against tenant-identity once that flow is wired.
 */
export function middleware(req: NextRequest): NextResponse {
  if (!req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  const session = readDevSession();
  const headers = new Headers(req.headers);
  headers.set('x-tenant-id', session.tenantId);
  headers.set('x-user-id', session.userId);
  headers.set('x-roles', session.roles);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/api/:path*'],
};
