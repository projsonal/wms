import { NextResponse, type NextRequest } from 'next/server';

const SESSION_FLAG_COOKIE = 'stockrsd_has_session';

const AUTH_ONLY_PATHS = ['/login', '/register'];

const ALWAYS_ACCESSIBLE_PATHS = ['/changelog', '/status'];

function matchesAny(pathname: string, paths: string[]): boolean {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.get(SESSION_FLAG_COOKIE)?.value === '1';

  if (matchesAny(pathname, ALWAYS_ACCESSIBLE_PATHS)) {
    return NextResponse.next();
  }

  if (matchesAny(pathname, AUTH_ONLY_PATHS)) {

    if (hasSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);

    loginUrl.searchParams.set('redirect', pathname);

    loginUrl.searchParams.set('reason', 'unauthorized');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {

  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets/|api/gowms/|uploads/).*)'],
};