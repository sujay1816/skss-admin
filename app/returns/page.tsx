'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function ReturnsPage() {
  const [returns, setReturns] = useState<any[]>([])

  useEffect(() => {
    supabase.from('orders').select('*, profiles(full_name, email)').eq('status', 'return_requested').order('return_requested_at', { ascending: false }).then(({ data }) => setReturns(data || []))
  }, [])

  const update = async (id: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id)
    setReturns(prev => prev.filter(r => r.id !== id))
    toast.success(`Return ${status === 'return_approved' ? 'approved' : 'rejected'}`)
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Return Requests</h1>
        {returns.length === 0 ? <div className="card p-10 text-center text-sm text-gray-400">No pending return requests</div> : (
          <div className="space-y-4">
            {returns.map(r => (
              <div key={r.id} className="card p-5 border-l-4" style={{ borderLeftColor: '#7C3AED' }}>
                <div className="flex items-start justify-between mb-3">
                  <div><p className="font-mono font-semibold" style={{ color: 'var(--crimson)' }}>{r.order_number}</p><p className="font-medium text-gray-900">{r.profiles?.full_name}</p><p className="text-xs text-gray-500">{r.profiles?.email}</p></div>
                  <p className="text-xs text-gray-500">{r.return_requested_at && new Date(r.return_requested_at).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="p-3 rounded text-sm mb-4" style={{ background: '#F5F3FF', color: '#4C1D95' }}>
                  <p className="font-medium mb-1">Return Reason:</p>
                  <p>{r.return_reason}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => update(r.id, 'return_approved')} className="btn btn-primary">Approve Return</button>
                  <button onClick={() => update(r.id, 'return_rejected')} className="btn btn-danger">Reject Return</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
