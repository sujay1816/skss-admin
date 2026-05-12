import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// All valid staff roles — includes 'manager' for backward compatibility
const STAFF_ROLES = ['staff', 'admin', 'manager', 'superadmin']

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

  if (path === '/login') {
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

  if (!user) return NextResponse.redirect(new URL('/login', request.url))

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
