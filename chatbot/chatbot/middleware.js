import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function middleware(request) {
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET 
  });

  const { pathname } = request.nextUrl;
  const adminEmails = getAdminEmails();
  const tokenEmail = token?.email ? String(token.email).toLowerCase() : '';
  const isAdmin = Boolean(tokenEmail && adminEmails.includes(tokenEmail));

  // Public routes
  const publicRoutes = ['/', '/login', '/auth', '/api/auth'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // If user is not authenticated and trying to access protected route
  if (!token && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only monitor routes
  if (token && !isAdmin && pathname.startsWith('/dashboard')) {
    const assistantUrl = new URL('/assistant', request.url);
    return NextResponse.redirect(assistantUrl);
  }

  // Admin-only monitor APIs
  if (token && !isAdmin && pathname.startsWith('/api/security')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // If authenticated user tries to access login/auth, redirect by role
  if (token && (pathname === '/login' || pathname === '/auth')) {
    const nextUrl = new URL(isAdmin ? '/dashboard' : '/assistant', request.url);
    return NextResponse.redirect(nextUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
