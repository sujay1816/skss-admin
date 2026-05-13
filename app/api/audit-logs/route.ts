import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// QA FIX — SEC-024, AUDT-013, AUDT-014
// Append-only audit log API.
//
// GET  /api/audit-logs — read logs (admin/manager/superadmin only)
// POST /api/audit-logs — create a new log entry (admin/staff only)
// DELETE/PUT/PATCH — ALL BLOCKED — audit logs are immutable (AUDT-013/014)
//
// Note: The real tamper-prevention for audit logs should be enforced at the
// database level with RLS policies. This API layer is the application-level guard.
// Required Supabase RLS for audit_logs table:
//   CREATE POLICY "Append only" ON audit_logs
//     FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
//   CREATE POLICY "Read admin" ON audit_logs
//     FOR SELECT USING (
//       EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager','superadmin'))
//     );
//   -- No UPDATE or DELETE policy = those operations are blocked by RLS

async function getAdminUser(token: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_blocked, full_name, email')
    .eq('id', user.id)
    .single()
  if (!profile || profile.is_blocked) return null
  return { user, profile, supabase }
}

function getToken(req: NextRequest): string {
  return (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
}

// GET — read audit logs (manager+ only)
export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await getAdminUser(token)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { profile, supabase } = auth
  const READER_ROLES = ['admin', 'manager', 'superadmin']
  if (!READER_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden: insufficient role' }, { status: 403 })
  }

  // Parse query params
  const url = new URL(req.url)
  const page = Math.max(1, Number(url.searchParams.get('page') || 1))
  const limit = Math.min(100, Number(url.searchParams.get('limit') || 50))
  const from = (page - 1) * limit
  const to = from + limit - 1
  const actionFilter = url.searchParams.get('action')
  const adminIdFilter = url.searchParams.get('admin_id')

  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (actionFilter) query = query.eq('action', actionFilter)
  if (adminIdFilter) query = query.eq('admin_id', adminIdFilter)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ logs: data, total: count, page, limit })
}

// POST — create audit log entry
export async function POST(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await getAdminUser(token)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, profile, supabase } = auth
  const WRITER_ROLES = ['staff', 'admin', 'manager', 'superadmin']
  if (!WRITER_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { action: string; entity_type?: string; entity_id?: string; details?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 })
  }

  // Get client IP for audit trail
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      admin_id:    user.id,
      admin_email: profile.email,
      admin_name:  profile.full_name,
      admin_role:  profile.role,
      action:      body.action,
      entity_type: body.entity_type || null,
      entity_id:   body.entity_id || null,
      details:     body.details ? JSON.stringify(body.details) : null,
      ip_address:  ip,
      created_at:  new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ log: data }, { status: 201 })
}

// QA FIX — AUDT-013, AUDT-014: Block ALL mutation methods on audit logs
// Audit logs are append-only. DELETE and UPDATE/PATCH are explicitly blocked.
export async function DELETE() {
  return NextResponse.json(
    { error: 'Audit logs are immutable and cannot be deleted. This action is not permitted.' },
    { status: 403 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Audit logs are immutable and cannot be modified. This action is not permitted.' },
    { status: 403 }
  )
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Audit logs are immutable and cannot be modified. This action is not permitted.' },
    { status: 403 }
  )
}
