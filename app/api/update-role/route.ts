import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Uses service role key to bypass RLS — only callable by verified superadmins
export async function POST(request: Request) {
  try {
    const cookieStore = cookies()

    // 1. Verify the calling user is a superadmin via their session
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Check calling user's role
    const { data: callerProfile } = await supabaseUser
      .from('profiles').select('role').eq('id', user.id).single()

    if (callerProfile?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only superadmin can change roles' }, { status: 403 })
    }

    const { targetId, newRole } = await request.json()

    // 3. Prevent changing own role
    if (targetId === user.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
    }

    // 4. Prevent promoting to superadmin via API
    if (newRole === 'superadmin') {
      return NextResponse.json({ error: 'Cannot promote to superadmin via UI' }, { status: 400 })
    }

    const validRoles = ['staff', 'admin', 'customer']
    if (!validRoles.includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // 5. Use service role key to bypass RLS and actually update the row
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
