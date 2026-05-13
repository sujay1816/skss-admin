import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// QA FIX — API-006: This route previously had NO authentication check,
// meaning any unauthenticated request could call it to send WhatsApp/SMS.
// Now: requires a valid Supabase session with an admin/staff role before proceeding.
export async function POST(req: NextRequest) {
  // ── Auth check ──────────────────────────────────────────────────────────────
  // Use the service-role client to validate the auth token from the request
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()

  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Validate the JWT token and get user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the caller has a staff/admin role (not a customer account)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_blocked')
    .eq('id', user.id)
    .single()

  const ALLOWED_ROLES = ['staff', 'admin', 'manager', 'superadmin']
  if (!profile || !ALLOWED_ROLES.includes(profile.role) || profile.is_blocked) {
    return NextResponse.json({ success: false, error: 'Forbidden: admin access required' }, { status: 403 })
  }
  // ── End auth check ──────────────────────────────────────────────────────────

  // WhatsApp/SMS is disabled until DLT registration is complete.
  // DLT (Distributed Ledger Technology) registration is required by TRAI
  // for commercial SMS in India. Uncomment below after approval.
  //
  // How to enable:
  // 1. Register at https://www.fast2sms.com and complete DLT registration
  // 2. Add FAST2SMS_KEY to Vercel environment variables
  // 3. Uncomment the block below

  /*
  const { orderId, phone, orderNumber, trackingId, courierName } = await req.json()
  const { data: cfg } = await supabase.from('site_config').select('key,value').in('key', ['fast2sms_key','brand_name'])
  const config: Record<string,string> = {}
  cfg?.forEach((c: any) => { config[c.key] = c.value })
  const apiKey = config.fast2sms_key
  if (!apiKey) return NextResponse.json({ success: false, error: 'Fast2SMS not configured' })
  const message = `Your ${config.brand_name || 'SKSS'} order ${orderNumber} has been shipped via ${courierName}. Tracking ID: ${trackingId}. Track at skss.in/orders`
  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: { authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ route: 'q', message, language: 'english', flash: 0, numbers: phone.replace(/\D/g,'').slice(-10) })
  })
  const data = await res.json()
  if (data.return) {
    await supabase.from('orders').update({ whatsapp_sent: true }).eq('id', orderId)
    return NextResponse.json({ success: true })
  }
  return NextResponse.json({ success: false, error: data.message })
  */

  return NextResponse.json({
    success: false,
    error: 'WhatsApp notifications disabled until DLT registration is complete'
  })
}
