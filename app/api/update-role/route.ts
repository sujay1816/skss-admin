import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Uses service role key throughout — bypasses RLS for both read and write.
// Security is maintained by verifying the auth token via auth.getUser()
// and checking the caller's role before making any changes.
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Service role client — bypasses RLS for all operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Verify the token is valid and get the calling user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Read caller's role using service role key (bypasses RLS — always succeeds)
    const { data: callerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !callerProfile) {
      return NextResponse.json({ error: 'Could not verify your role' }, { status: 403 })
    }

    if (callerProfile.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only superadmin can change roles' }, { status: 403 })
    }

    const { targetId, newRole } = await request.json()

    if (!targetId || !newRole) {
      return NextResponse.json({ error: 'Missing targetId or newRole' }, { status: 400 })
    }

    // 3. Prevent changing own role
    if (targetId === user.id) {
      return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 })
    }

    // 4. Prevent promoting to superadmin via API
    if (newRole === 'superadmin') {
      return NextResponse.json({ error: 'Cannot promote to superadmin via UI' }, { status: 400 })
    }

    const validRoles = ['staff', 'admin', 'customer']
    if (!validRoles.includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role: ' + newRole }, { status: 400 })
    }

    // 5. Verify target user exists
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', targetId)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    // 6. Update role using service role key — bypasses RLS
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      updated: { id: targetId, from: targetProfile.role, to: newRole }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
