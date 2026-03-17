import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Never gate framework/static/api routes in auth middleware.
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/public') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET 
  });

  // Public routes (exact pages or explicit prefixes)
  const publicExactRoutes = new Set(['/', '/login', '/auth']);
  const publicPrefixRoutes = ['/auth/'];
  const isPublicRoute =
    publicExactRoutes.has(pathname) ||
    publicPrefixRoutes.some((prefix) => pathname.startsWith(prefix));

  // If user is not authenticated and trying to access protected route
  if (!token && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated user tries to access login/auth, redirect to dashboard
  if (token && (pathname === '/login' || pathname === '/auth')) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/:path*',
  ],
};
