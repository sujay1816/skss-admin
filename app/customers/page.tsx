'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

const PAGE_SIZE = 25

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const load = async () => {
    setLoading(true)
    // Fetch all profiles with role=customer
    const { data } = await supabase
      .from('profiles')
      .select('*, orders(count)')
      .eq('role', 'customer')
      .order('created_at', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleBlock = async (id: string, blocked: boolean) => {
    await supabase.from('profiles').update({ is_blocked: !blocked }).eq('id', id)
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, is_blocked: !blocked } : c))
    toast.success(blocked ? 'Customer unblocked' : 'Customer blocked')
  }

  const filtered = customers.filter(c =>
    !search ||
    (c.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  )

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <AdminLayout>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="text-sm text-gray-500">{customers.length} registered customers</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} disabled={loading}
              className="btn btn-secondary flex items-center gap-2 text-xs">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Info banner explaining the fix */}
        <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF' }}>
          <p className="font-semibold mb-0.5">ℹ️ Why customers might be missing</p>
          <p>Customers who signed up before today may not have a profile row. The storefront auth callback has been updated — all new signups will appear here automatically. For existing missing customers, ask them to log out and log back in.</p>
        </div>

        <div className="card">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9" style={{ height: 36 }} placeholder="Name, email or phone..."
                value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <p className="text-xs text-gray-400 hidden sm:block">{filtered.length} results</p>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {['Customer','Phone','WhatsApp','Orders','Joined','Status','Action'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{c.full_name || '—'}</p>
                      <p className="text-xs text-gray-400">{c.email}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{c.phone || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`badge ${c.whatsapp_opted_in ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {c.whatsapp_opted_in ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{c.orders?.[0]?.count || 0}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {new Date(c.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${c.is_blocked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                        {c.is_blocked ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button type="button" onClick={() => toggleBlock(c.id, c.is_blocked)}
                        className="text-xs font-medium px-3 py-1.5 rounded border transition-colors"
                        style={{ borderColor: c.is_blocked ? 'var(--crimson)' : '#E5E7EB', color: c.is_blocked ? 'var(--crimson)' : '#6B7280' }}>
                        {c.is_blocked ? 'Unblock' : 'Block'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="md:hidden divide-y divide-gray-100">
            {paginated.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                  style={{ background: c.is_blocked ? '#DC2626' : 'var(--crimson)' }}>
                  {(c.full_name || c.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm">{c.full_name || '—'}</p>
                  <p className="text-xs text-gray-400 truncate">{c.email}</p>
                  <p className="text-xs text-gray-400">{c.phone || 'No phone'} · {c.orders?.[0]?.count || 0} orders</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`badge text-xs ${c.is_blocked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                    {c.is_blocked ? 'Blocked' : 'Active'}
                  </span>
                  <button type="button" onClick={() => toggleBlock(c.id, c.is_blocked)}
                    className="text-xs font-medium" style={{ color: c.is_blocked ? 'var(--crimson)' : '#9CA3AF' }}>
                    {c.is_blocked ? 'Unblock' : 'Block'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-center py-10 text-sm text-gray-400">
              {loading ? 'Loading...' : 'No customers found'}
            </p>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 p-4 border-t border-gray-100">
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded border disabled:opacity-30" style={{ borderColor: '#E5E7EB' }}>
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
              <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-2 rounded border disabled:opacity-30" style={{ borderColor: '#E5E7EB' }}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
