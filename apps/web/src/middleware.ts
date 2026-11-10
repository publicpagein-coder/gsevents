import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { locales, defaultLocale } from './i18n/config'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

/**
 * Route segments (after the locale prefix) that require a signed-in session.
 * Route groups like (auth), (organizer), (sponsor) are stripped by Next.js so
 * the actual URL path has no parentheses.
 */
const PROTECTED_SEGMENTS = [
  'organizer-dashboard',
  'sponsor-dashboard',
  'profile',
  'admin',
]

function isProtectedPath(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length < 2) return false
  const segment = parts[1] ?? ''
  return PROTECTED_SEGMENTS.some((s) => segment === s || segment.startsWith(s + '/'))
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip Next.js internals and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    /\.\w+$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  // For protected paths: verify the Supabase session before running intl routing
  if (isProtectedPath(pathname)) {
    let response = NextResponse.next({ request: { headers: request.headers } })

    const supabase = createServerClient(
      process.env['NEXT_PUBLIC_SUPABASE_URL']!,
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            response = NextResponse.next({ request: { headers: request.headers } })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            )
          },
        },
      },
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      const locale = pathname.split('/')[1] ?? defaultLocale
      const loginUrl = new URL(`/${locale}/login`, request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    return response
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
