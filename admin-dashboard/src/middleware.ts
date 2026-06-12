import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SESSION_SECRET = process.env.SESSION_SECRET || ''
const IS_PROD = process.env.NODE_ENV === 'production'

const PUBLIC_ROUTES = ['/login', '/logout']
const AUTH_API_ROUTES = ['/api/auth/login', '/api/auth/logout', '/api/auth/me']

function getSecret(): Uint8Array {
  return new TextEncoder().encode(SESSION_SECRET)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt'
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get('session')?.value
  let valid = false
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecret(), {
        algorithms: ['HS256'],
      })
      if (payload.email) valid = true
    } catch {
      valid = false
    }
  }

  // Auth API routes — allow even without session (login must work)
  if (AUTH_API_ROUTES.includes(pathname)) {
    return NextResponse.next()
  }

  // Public pages
  if (PUBLIC_ROUTES.includes(pathname)) {
    if (valid && pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // Protected: no valid session
  if (!valid) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Security headers for all responses
  const response = NextResponse.next()
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  if (IS_PROD) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  response.headers.set(
    'Content-Security-Policy',
    "frame-ancestors 'none'",
  )

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
