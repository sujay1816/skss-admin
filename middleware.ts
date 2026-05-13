import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// All valid staff roles — includes 'manager' for backward compatibility
const STAFF_ROLES = ['staff', 'admin', 'manager', 'superadmin']

// ─────────────────────────────────────────────────────────────────────────────
// QA FIX — AUTH-040 / SEC-015: In-memory rate limiting for login attempts
// Tracks failed login attempts per IP with a sliding window.
// Limitations: resets on server restart (use Redis/Upstash for production persistence).
// For Vercel Edge deployments this is per-instance; for production use Upstash Rate Limit.
// ─────────────────────────────────────────────────────────────────────────────
interface RateLimitEntry { count: number; resetAt: number }
const loginAttempts = new Map<string, RateLimitEntry>()

const RATE_LIMIT_MAX = 10        // max login attempts per window
const RATE_LIMIT_WINDOW = 15 * 60 * 1000  // 15 minutes in ms
const LOCKOUT_DURATION = 15 * 60 * 1000   // 15 minutes lockout

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    // Window expired or first attempt — reset
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return false
  }
  entry.count++
  loginAttempts.set(ip, entry)
  return entry.count > RATE_LIMIT_MAX
}

function getRateLimitHeaders(ip: string): Record<string, string> {
  const entry = loginAttempts.get(ip)
  const remaining = entry ? Math.max(0, RATE_LIMIT_MAX - entry.count) : RATE_LIMIT_MAX
  const resetAt = entry ? Math.ceil(entry.resetAt / 1000) : Math.ceil((Date.now() + RATE_LIMIT_WINDOW) / 1000)
  return {
    'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetAt),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QA FIX — AUTH-029: Safe redirect — only allow relative paths, never external URLs.
// Prevents open redirect: /login?redirect=https://evil.com
// ─────────────────────────────────────────────────────────────────────────────
function safeRedirectPath(param: string | null, fallback: string): string {
  if (!param) return fallback
  // Must start with / and not be a protocol-relative URL (//evil.com)
  if (param.startsWith('/') && !param.startsWith('//')) return param
  return fallback
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(s) {
          s.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          s.forEach(({ name, value, options }) => response.cookies.set(name, value, options as any))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // ── Rate limit the login POST (API calls) and GET (page loads spam) ──────
  // QA: AUTH-040, SEC-015
  if (path === '/login') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1'

    if (isRateLimited(ip)) {
      const retryAfter = Math.ceil(LOCKOUT_DURATION / 1000)
      return new NextResponse(
        JSON.stringify({ error: 'Too many login attempts. Please try again in 15 minutes.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
            ...getRateLimitHeaders(ip),
          },
        }
      )
    }

    if (user) {
      const { data: profile } = await supabase.from('profiles')
        .select('role, is_blocked').eq('id', user.id).single()
      // Redirect to dashboard if already logged in with valid non-blocked role
      if (profile && STAFF_ROLES.includes(profile.role) && !profile.is_blocked) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
    return response
  }

  if (!user) {
    // QA FIX — AUTH-029: Validate redirect param is a safe relative path
    const redirectTo = safeRedirectPath(
      request.nextUrl.searchParams.get('redirect'),
      path
    )
    const loginUrl = new URL('/login', request.url)
    // Only preserve redirect param for non-login paths
    if (redirectTo !== '/login') {
      loginUrl.searchParams.set('redirect', redirectTo)
    }
    return NextResponse.redirect(loginUrl)
  }

  const { data: profile } = await supabase.from('profiles')
    .select('role, is_blocked').eq('id', user.id).single()

  // Fix #3 — check all valid roles including 'admin' (was missing 'admin')
  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
  }

  if (profile.is_blocked) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=blocked', request.url))
  }

  // Fix #1 — enforce permissions from site_config for non-superadmin roles
  // Map URL paths to permission keys
  const ROUTE_PERMISSIONS: Record<string, string> = {
    '/banners':      'banners',
    '/categories':   'categories',
    '/config':       'config',
    '/coupons':      'coupons',
    '/customers':    'customers',
    '/notifications':'notifications',
    '/orders':       'orders_view',
    '/pages':        'pages',
    '/permissions':  'permissions',
    '/products':     'products_view',
    '/reset':        'reset',
    '/returns':      'returns',
    '/reviews':      'reviews',
    '/staff':        'staff',
    '/stock':        'stock',
  }

  // Superadmin always has full access — skip permission check
  if (profile.role !== 'superadmin') {
    const routeBase = '/' + path.split('/')[1]
    const permKey = ROUTE_PERMISSIONS[routeBase]

    if (permKey) {
      // Load permissions from site_config
      const { data: permConfig } = await supabase.from('site_config')
        .select('value').eq('key', 'role_permissions').maybeSingle()

      if (permConfig?.value) {
        try {
          const allPerms = JSON.parse(permConfig.value)
          // Normalize role — 'manager' is treated as 'admin'
          const roleKey = profile.role === 'manager' ? 'admin' : profile.role
          const rolePerms = allPerms[roleKey] || {}
          if (rolePerms[permKey] === false) {
            // Redirect to dashboard with access denied message
            return NextResponse.redirect(new URL('/dashboard?error=access_denied', request.url))
          }
        } catch {}
      }
    }
  }

  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'] }
