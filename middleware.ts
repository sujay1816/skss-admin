import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const STAFF_ROLES = ['staff', 'admin', 'manager', 'superadmin']

// ── Rate limiting ─────────────────────────────────────────────────────────────
interface RateLimitEntry { count: number; resetAt: number }
const loginAttempts = new Map<string, RateLimitEntry>()
const RATE_LIMIT_MAX    = 10
const RATE_LIMIT_WINDOW = 15 * 60 * 1000
const LOCKOUT_DURATION  = 15 * 60 * 1000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
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
  const resetAt   = entry ? Math.ceil(entry.resetAt / 1000) : Math.ceil((Date.now() + RATE_LIMIT_WINDOW) / 1000)
  return {
    'X-RateLimit-Limit':     String(RATE_LIMIT_MAX),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset':     String(resetAt),
  }
}

// ── Safe redirect ─────────────────────────────────────────────────────────────
function safeRedirectPath(param: string | null, fallback: string): string {
  if (!param) return fallback
  if (param.startsWith('/') && !param.startsWith('//')) return param
  return fallback
}

// ── Route → permission key mapping ───────────────────────────────────────────
// Longer paths must come before shorter ones — matched by longest prefix
const ROUTE_PERMISSIONS: Record<string, string> = {
  // Products — edit routes checked separately from view
  '/products/new':     'products_edit',
  '/products/bulk':    'products_edit',
  '/products/':        'products_edit',   // /products/[id] — edit product
  '/products':         'products_view',

  // Orders — detail page needs view, but action buttons check edit client-side
  '/orders/':          'orders_view',     // /orders/[id]
  '/orders':           'orders_view',

  '/banners':          'banners',
  '/categories':       'categories',
  '/config':           'config',
  '/coupons':          'coupons',
  '/customers':        'customers',
  '/notifications':    'notifications',
  '/pages':            'pages',
  '/permissions':      'permissions',
  '/reset':            'reset',
  '/returns':          'returns',
  '/reviews':          'reviews',
  '/staff':            'staff',
  '/stock':            'stock',
  // /dashboard — accessible to all staff, no permission key needed
}

// ── Default permissions ────────────────────────────────────────────────────────
// Single source of truth — mirrors DEFAULT_PERMISSIONS in permissions/page.tsx
// Used when site_config has no saved value, or key is missing from saved value
const DEFAULT_ROLE_PERMS: Record<string, Record<string, boolean>> = {
  staff: {
    dashboard: true,
    orders_view: true, orders_edit: true,
    products_view: true, products_edit: true, products_delete: false,
    stock: true,
    customers: true, customers_block: false,
    reviews: true,
    banners: false, categories: false, pages: false,
    coupons: true, coupons_manage: false,
    returns: true,
    notifications: true,
    config: false, staff: false, permissions: false, reset: false,
  },
  admin: {
    dashboard: true,
    orders_view: true, orders_edit: true,
    products_view: true, products_edit: true, products_delete: true,
    stock: true,
    customers: true, customers_block: true,
    reviews: true,
    banners: true, categories: true, pages: true,
    coupons: true, coupons_manage: true,
    returns: true,
    notifications: true,
    config: true, staff: true, permissions: false, reset: false,
  },
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

  // ── Login route ───────────────────────────────────────────────────────────
  if (path === '/login') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1'

    if (isRateLimited(ip)) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many login attempts. Please try again in 15 minutes.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(LOCKOUT_DURATION / 1000)),
            ...getRateLimitHeaders(ip),
          },
        }
      )
    }

    if (user) {
      const { data: profile } = await supabase.from('profiles')
        .select('role, is_blocked').eq('id', user.id).single()
      if (profile && STAFF_ROLES.includes(profile.role) && !profile.is_blocked) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
    return response
  }

  // ── Auth check ────────────────────────────────────────────────────────────
  if (!user) {
    const redirectTo = safeRedirectPath(request.nextUrl.searchParams.get('redirect'), path)
    const loginUrl = new URL('/login', request.url)
    if (redirectTo !== '/login') loginUrl.searchParams.set('redirect', redirectTo)
    return NextResponse.redirect(loginUrl)
  }

  const { data: profile } = await supabase.from('profiles')
    .select('role, is_blocked').eq('id', user.id).single()

  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
  }

  if (profile.is_blocked) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=blocked', request.url))
  }

  // ── Permission check (non-superadmin only) ────────────────────────────────
  if (profile.role !== 'superadmin') {
    // Find longest matching route prefix
    const matchedRoute = Object.keys(ROUTE_PERMISSIONS)
      .filter(route => {
        if (route.endsWith('/')) return path.startsWith(route) && path.length > route.length
        return path === route || path.startsWith(route + '/')
      })
      .sort((a, b) => b.length - a.length)[0]

    const permKey = matchedRoute ? ROUTE_PERMISSIONS[matchedRoute] : undefined

    if (permKey) {
      const roleKey = profile.role === 'manager' ? 'admin' : profile.role
      let allowed = true

      const { data: permConfig } = await supabase.from('site_config')
        .select('value').eq('key', 'role_permissions').maybeSingle()

      if (permConfig?.value) {
        try {
          const allPerms = JSON.parse(permConfig.value)
          const rolePerms = allPerms[roleKey] || {}
          // Use saved value if key exists, otherwise fall back to DEFAULT_ROLE_PERMS
          allowed = permKey in rolePerms
            ? rolePerms[permKey] !== false
            : (DEFAULT_ROLE_PERMS[roleKey]?.[permKey] ?? true)
        } catch {
          allowed = DEFAULT_ROLE_PERMS[roleKey]?.[permKey] ?? true
        }
      } else {
        allowed = DEFAULT_ROLE_PERMS[roleKey]?.[permKey] ?? true
      }

      if (!allowed) {
        return NextResponse.redirect(new URL('/dashboard?error=access_denied', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
