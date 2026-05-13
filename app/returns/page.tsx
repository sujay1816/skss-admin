'use client'
// QA FIX — Returns: Approve/Reject acted immediately with no confirmation.
// Added ConfirmModal before both approve and reject to prevent accidental clicks.
// QA: General UX — irreversible actions require confirmation.
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { useConfirm } from '@/components/ui/ConfirmModal'

export default function ReturnsPage() {
  const [returns, setReturns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // QA FIX — replace instant action with confirmed modal
  const { confirm, ConfirmModal } = useConfirm()

  useEffect(() => {
    supabase.from('orders')
      .select('*, profiles(full_name, email), order_items(product_name, colour, quantity)')
      .eq('status', 'return_requested')
      .order('return_requested_at', { ascending: false })
      .then(({ data }) => { setReturns(data || []); setLoading(false) })
  }, [])

  const update = async (id: string, status: string, orderNumber: string) => {
    const isApprove = status === 'return_approved'

    // QA FIX: confirm before irreversible return decision
    const ok = await confirm({
      title: isApprove ? 'Approve Return?' : 'Reject Return?',
      message: isApprove
        ? `Approve return for order ${orderNumber}? Stock will be restored and refund can be initiated.`
        : `Reject return for order ${orderNumber}? The customer will be notified.`,
      confirmLabel: isApprove ? 'Approve Return' : 'Reject Return',
      danger: !isApprove,
    })
    if (!ok) return

    const { error } = await supabase.from('orders').update({ status }).eq('id', id)
    if (error) { toast.error('Failed to update return status: ' + error.message); return }
    setReturns(prev => prev.filter(r => r.id !== id))
    toast.success(`Return ${isApprove ? 'approved' : 'rejected'}`)
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Return Requests</h1>
        {loading ? (
          <div className="text-center py-12 text-sm text-gray-400">Loading...</div>
        ) : returns.length === 0 ? (
          <div className="card p-10 text-center text-sm text-gray-400">No pending return requests</div>
        ) : (
          <div className="space-y-4">
            {returns.map(r => {
              const orderRef = r.order_number || `#${r.id.slice(0, 8).toUpperCase()}`
              return (
                <div key={r.id} className="card p-5 border-l-4" style={{ borderLeftColor: '#7C3AED' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-mono font-semibold" style={{ color: 'var(--crimson)' }}>
                        {orderRef}
                      </p>
                      <p className="font-medium text-gray-900">{r.profiles?.full_name}</p>
                      <p className="text-xs text-gray-500">{r.profiles?.email}</p>
                      <p className="text-sm font-semibold mt-1" style={{ color: 'var(--crimson)' }}>
                        ₹{Number(r.total_amount).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">
                      {r.return_requested_at && new Date(r.return_requested_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {r.order_items?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {r.order_items.map((item: any, i: number) => (
                        <span key={i} className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                          {item.product_name} ({item.colour}) × {item.quantity}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="p-3 rounded text-sm mb-4" style={{ background: '#F5F3FF', color: '#4C1D95' }}>
                    <p className="font-medium mb-1">Return Reason:</p>
                    <p>{r.return_reason || 'No reason provided'}</p>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => update(r.id, 'return_approved', orderRef)} className="btn btn-primary">
                      Approve Return
                    </button>
                    <button type="button" onClick={() => update(r.id, 'return_rejected', orderRef)} className="btn" style={{ background: '#DC2626', color: 'white' }}>
                      Reject Return
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {/* QA FIX — ConfirmModal portal */}
      {ConfirmModal}
    </AdminLayout>
  )
}
