import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile && ['staff','manager','superadmin'].includes(profile.role)) return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }
  if (!user) return NextResponse.redirect(new URL('/login', request.url))
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['staff','manager','superadmin'].includes(profile.role)) return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'] }
