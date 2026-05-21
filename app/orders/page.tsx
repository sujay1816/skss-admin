'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

// Status colors — matches orders_status_check DB constraint
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 30

  const load = async (p = 1, s = search, st = statusFilter) => {
    setLoading(true)
    // FIX: server-side pagination — only fetch current page from DB
    const from = (p - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    let q = supabase.from('orders')
      .select('*, profiles(full_name, email, phone)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    if (st) q = q.eq('status', st)
    if (s) q = q.or(`order_number.ilike.%${s}%,profiles.full_name.ilike.%${s}%,profiles.email.ilike.%${s}%`)
    const { data, count } = await q
    setOrders(data || [])
    setTotalCount(count || 0)
    setLoading(false)
  }

  useEffect(() => { load(1, '', statusFilter) }, [statusFilter])

  // Search and pagination are server-side — no client-side filter needed
  const filtered = orders
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const paginated = orders

  return (
    <AdminLayout>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Orders</h1>
        <div className="card">
          <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9" style={{ height: 36, width: 240 }} placeholder="Search by order #, name, email..." value={search} onChange={e => { const v = e.target.value; setSearch(v); setPage(1); load(1, v, statusFilter) }} />
            </div>
            <select className="input" style={{ height: 36, width: 180 }} value={statusFilter} onChange={e => { const v = e.target.value; setStatusFilter(v); setPage(1); load(1, search, v) }}>
              <option value="">All Statuses</option>

              {['confirmed','shipped','delivered','cancelled','return_requested','return_approved','return_rejected','refunded'].map(s => (
                <option key={s} value={s} className="capitalize">{s.replace(/_/g,' ')}</option>
              ))}
            </select>
          </div>
          {/* Fix #15 — Mobile card layout for orders */}
          <div className="md:hidden divide-y divide-gray-100">
            {paginated.map(o => (
              <div key={o.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-mono font-semibold text-xs" style={{ color: 'var(--crimson)' }}>
                      {o.order_number || `#${o.id.slice(0,8).toUpperCase()}`}
                    </p>
                    <p className="font-medium text-gray-900 text-sm">{o.profiles?.full_name || '—'}</p>
                    <p className="text-xs text-gray-400">{o.profiles?.phone || o.profiles?.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">₹{Number(o.total_amount).toLocaleString('en-IN')}</p>
                    <span className="badge text-white text-xs capitalize" style={{ background: STATUS_COLORS[o.status] || '#6B7280' }}>
                      {o.status.replace(/_/g,' ')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    {new Date(o.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                  </p>
                  <a href={`/orders/${o.id}`} className="text-xs font-medium" style={{ color: 'var(--crimson)' }}>Manage →</a>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {['Order #','Customer','Amount','Payment','Status','Date','Action'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(o => (
                  <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-mono text-xs font-semibold" style={{ color: 'var(--crimson)' }}>
                      {o.order_number || `#${o.id.slice(0,8).toUpperCase()}`}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{o.profiles?.full_name || '—'}</p>
                      <p className="text-xs text-gray-400">{o.profiles?.phone || o.profiles?.email}</p>
                    </td>
                    <td className="px-5 py-3 font-semibold text-gray-900">₹{Number(o.total_amount).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3">
                      <span className={`badge ${o.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {o.payment_method.toUpperCase()} · {o.payment_status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="badge text-white text-xs capitalize" style={{ background: STATUS_COLORS[o.status] || '#6B7280' }}>
                        {o.status.replace(/_/g,' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {new Date(o.created_at).toLocaleDateString('en-IN', { day:'numeric',month:'short',year:'numeric' })}
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/orders/${o.id}`} className="text-xs font-medium" style={{ color: 'var(--crimson)' }}>Manage</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-center py-12 text-sm text-gray-400">{loading ? 'Loading...' : 'No orders found'}</p>
            )}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button type="button" onClick={() => { const p = Math.max(1, page - 1); setPage(p); load(p, search, statusFilter) }} disabled={page === 1}
              className="p-2 rounded border disabled:opacity-30" style={{ borderColor: '#E5E7EB' }}>
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages} · {totalCount} orders</span>
            <button type="button" onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); load(p, search, statusFilter) }} disabled={page === totalPages}
              className="p-2 rounded border disabled:opacity-30" style={{ borderColor: '#E5E7EB' }}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
