'use client'
// QA FIXES applied to this file:
//   ORD-008 — invalid status transitions blocked (e.g. cancelled → confirmed)
//   ORD-020 — duplicate refund prevention (already refunded orders cannot be refunded again)
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import toast from 'react-hot-toast'

const formatPrice2 = (n: number) => '₹' + Number(n).toLocaleString('en-IN')

const STATUSES = ['confirmed','shipped','delivered','cancelled','return_requested','return_approved','return_rejected','refunded']

const STATUS_COLORS: Record<string, string> = {
  confirmed:        '#059669',
  shipped:          '#D97706',
  delivered:        '#16A34A',
  cancelled:        '#DC2626',
  pending:          '#D97706',
  return_requested: '#7C3AED',
  return_approved:  '#1565C0',
  return_rejected:  '#DC2626',
  refunded:         '#059669',
}

// QA FIX — ORD-008: Define which status transitions are valid.
// Key = current status, Value = statuses it can transition TO.
// Prevents admins from reopening cancelled orders or moving backwards.
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:          ['confirmed', 'cancelled'],
  confirmed:        ['shipped', 'cancelled'],
  shipped:          ['delivered', 'return_requested'],
  delivered:        ['return_requested'],
  return_requested: ['return_approved', 'return_rejected'],
  return_approved:  ['refunded'],
  return_rejected:  [],   // terminal — no forward transitions
  cancelled:        [],   // terminal — cannot reopen
  refunded:         [],   // terminal — QA ORD-020
}

function getAllowedStatuses(currentStatus: string): string[] {
  // Always include current status so the select isn't forced to change
  return [currentStatus, ...(VALID_TRANSITIONS[currentStatus] || [])]
}

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [status, setStatus] = useState('')
  const [trackingId, setTrackingId] = useState('')
  const [courierName, setCourierName] = useState('')
  const [saving, setSaving] = useState(false)
  const [waNotified, setWaNotified] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: o } = await supabase.from('orders').select('*, profiles(full_name,email,phone,whatsapp_opted_in)').eq('id', params.id).single()
      const { data: i } = await supabase.from('order_items').select('*').eq('order_id', params.id)
      setOrder(o); setItems(i || [])
      setStatus(o?.status || ''); setTrackingId(o?.tracking_id || ''); setCourierName(o?.courier_name || '')
      setWaNotified(o?.whatsapp_sent || false)
    }
    load()
  }, [params.id])

  const save = async () => {
    if (!order) return

    // QA FIX — ORD-008: Validate status transition before saving
    const allowed = getAllowedStatuses(order.status)
    if (!allowed.includes(status)) {
      toast.error(`Cannot change status from "${order.status}" to "${status}". Invalid transition.`)
      return
    }

    // QA FIX — ORD-020: Duplicate refund prevention
    // If the order is already refunded, block any further status changes
    if (order.status === 'refunded' && status !== 'refunded') {
      toast.error('This order has already been refunded and cannot be modified.')
      return
    }
    // If trying to set refunded when not approved — must come via return_approved
    if (status === 'refunded' && order.status !== 'return_approved') {
      toast.error('Refund can only be processed after return is approved.')
      return
    }

    setSaving(true)
    try {
      const { error: statusError } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', params.id)

      if (statusError) {
        toast.error('Status update failed: ' + statusError.message)
        setSaving(false)
        return
      }

      if (trackingId || courierName) {
        await supabase
          .from('orders')
          .update({
            tracking_id: trackingId || null,
            courier_name: courierName || null,
          })
          .eq('id', params.id)
      }

      toast.success('Order updated!')
      setOrder((prev: any) => ({ ...prev, status }))

      if (status === 'shipped' && trackingId && order.profiles?.whatsapp_opted_in && !waNotified) {
        try {
          await fetch('/api/whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: params.id, phone: order.profiles.phone, orderNumber: order.order_number || order.id.slice(0,8).toUpperCase(), trackingId, courierName })
          })
          setWaNotified(true)
          toast.success('WhatsApp notification sent!')
        } catch {}
      }
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    }
    setSaving(false)
  }

  if (!order) return <AdminLayout><div className="text-center py-20 text-sm text-gray-400">Loading...</div></AdminLayout>

  const addr = order.address_snapshot || order.shipping_address || {}
  const allowedStatuses = getAllowedStatuses(order.status)
  const isTerminal = VALID_TRANSITIONS[order.status]?.length === 0

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button type="button" onClick={() => router.back()} className="text-xs text-gray-500 mb-1 hover:underline">← Orders</button>
            <h1 className="text-2xl font-bold text-gray-900">
              {order.order_number || `#${order.id.slice(0,8).toUpperCase()}`}
            </h1>
            <p className="text-sm text-gray-500">
              {new Date(order.created_at).toLocaleDateString('en-IN', { day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit' })}
            </p>
          </div>
          <span className="badge text-white" style={{ background: STATUS_COLORS[order.status] || '#6B7280', fontSize: 13, padding: '4px 14px' }}>
            {order.status.replace(/_/g,' ')}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {/* Items */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Items ({items.length})</h2>
              {items.map(item => (
                <div key={item.id} className="flex gap-4 py-3 border-b last:border-0" style={{ borderColor: '#F3F4F6' }}>
                  <div className="w-14 h-20 border rounded overflow-hidden flex-shrink-0" style={{ background: '#F5EDE3', borderColor: '#E5E7EB' }}>
                    {item.product_image
                      ? <Image src={item.product_image} alt={item.product_name} width={56} height={80} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">🥻</div>
                    }
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.product_name}</p>
                    <p className="text-xs text-gray-500">{item.colour} · Qty {item.quantity}</p>
                    <p className="text-sm font-semibold mt-1" style={{ color: 'var(--crimson)' }}>{formatPrice2(item.total)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Update status */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Update Order</h2>

              {/* QA FIX — ORD-008: Show terminal state notice */}
              {isTerminal ? (
                <div className="p-3 rounded text-sm mb-4" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <p className="text-gray-500">
                    This order is in a terminal state (<strong>{order.status.replace(/_/g,' ')}</strong>) and cannot be updated further.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-600 mb-1 block">Order Status</label>
                      {/* QA FIX — ORD-008: Only show valid next statuses */}
                      <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
                        {allowedStatuses.map(s => (
                          <option key={s} value={s} className="capitalize">{s.replace(/_/g,' ')}</option>
                        ))}
                      </select>
                      {status !== order.status && (
                        <p className="text-xs text-amber-600 mt-1">
                          ⚠ Changing from <strong>{order.status.replace(/_/g,' ')}</strong> to <strong>{status.replace(/_/g,' ')}</strong>
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Courier Name</label>
                      <input className="input" value={courierName} onChange={e => setCourierName(e.target.value)} placeholder="Delhivery, BlueDart..." />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Tracking ID</label>
                      <input className="input" value={trackingId} onChange={e => setTrackingId(e.target.value)} placeholder="AWB number" />
                    </div>
                  </div>
                  {status === 'shipped' && trackingId && !waNotified && order.profiles?.whatsapp_opted_in && process.env.NEXT_PUBLIC_WHATSAPP && (
                    <p className="text-xs mt-3 p-2 bg-green-50 border border-green-200 rounded text-green-700">
                      ✓ WhatsApp notification will be sent to {order.profiles?.phone} when you save.
                    </p>
                  )}
                  {waNotified && <p className="text-xs mt-3 text-green-600">✓ WhatsApp notification already sent</p>}
                  <button type="button" onClick={save} disabled={saving} className="btn btn-primary mt-4">
                    {saving ? 'Saving...' : 'Update Order'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="card p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Customer</h2>
              <p className="font-medium text-gray-900">{order.profiles?.full_name}</p>
              <p className="text-xs text-gray-500">{order.profiles?.email}</p>
              <p className="text-xs text-gray-500">{order.profiles?.phone}</p>
              {order.profiles?.whatsapp_opted_in && (
                <span className="text-xs text-green-600 mt-1 block">✓ WhatsApp opted in</span>
              )}
            </div>

            <div className="card p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Delivery Address</h2>
              <p className="text-sm font-medium">{addr.full_name}</p>
              <p className="text-xs text-gray-500">{addr.address_line1}</p>
              {addr.address_line2 && <p className="text-xs text-gray-500">{addr.address_line2}</p>}
              <p className="text-xs text-gray-500">{addr.city}, {addr.state}</p>
              <p className="text-xs text-gray-500">{addr.pincode}</p>
              <p className="text-xs text-gray-600 mt-1 font-medium">📞 {addr.phone}</p>
            </div>

            <div className="card p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Payment Summary</h2>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatPrice2(order.subtotal)}</span></div>
                {order.coupon_code && (
                  <div className="flex justify-between">
                    <span className="text-green-600">Coupon ({order.coupon_code})</span>
                    <span className="text-green-600">−{formatPrice2(order.coupon_discount || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between"><span className="text-gray-500">Shipping</span><span>{order.shipping_charge > 0 ? formatPrice2(order.shipping_charge) : 'FREE'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">GST</span><span>{formatPrice2(order.total_gst)}</span></div>
                <div className="flex justify-between font-semibold border-t pt-2" style={{ borderColor: '#F3F4F6' }}>
                  <span>Total</span><span style={{ color: 'var(--crimson)' }}>{formatPrice2(order.total_amount)}</span>
                </div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">Method</span><span className="uppercase font-medium">{order.payment_method}</span></div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Payment</span>
                  <span className={`font-medium ${order.payment_status === 'paid' ? 'text-green-600' : 'text-orange-500'}`}>
                    {order.payment_status}
                  </span>
                </div>
              </div>
            </div>

            {order.return_reason && (
              <div className="card p-4 border-l-4" style={{ borderLeftColor: '#7C3AED' }}>
                <h2 className="font-semibold text-gray-900 mb-2">Return Request</h2>
                <p className="text-sm text-gray-600">{order.return_reason}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {order.return_requested_at && new Date(order.return_requested_at).toLocaleDateString('en-IN')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
