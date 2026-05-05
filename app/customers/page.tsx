'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('profiles').select('*, orders(count)').eq('role', 'customer').order('created_at', { ascending: false }).then(({ data }) => { setCustomers(data || []); setLoading(false) })
  }, [])

  const toggleBlock = async (id: string, blocked: boolean) => {
    await supabase.from('profiles').update({ is_blocked: !blocked }).eq('id', id)
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, is_blocked: !blocked } : c))
    toast.success(blocked ? 'Customer unblocked' : 'Customer blocked')
  }

  const filtered = customers.filter(c => !search || (c.full_name || '').toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()))

  return (
    <AdminLayout>
      <div>
        <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-bold text-gray-900">Customers</h1><p className="text-sm text-gray-500">{customers.length} total</p></div>
        <div className="card">
          <div className="p-4 border-b border-gray-100"><div className="relative max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input className="input pl-9" style={{ height: 36 }} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} /></div></div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50/50">{['Customer','Phone','WhatsApp','Joined','Status','Action'].map(h => <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3"><p className="font-medium text-gray-900">{c.full_name || '—'}</p><p className="text-xs text-gray-400">{c.email}</p></td>
                  <td className="px-5 py-3 text-gray-600">{c.phone || '—'}</td>
                  <td className="px-5 py-3"><span className={`badge ${c.whatsapp_opted_in ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.whatsapp_opted_in ? 'Yes' : 'No'}</span></td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{new Date(c.created_at).toLocaleDateString('en-IN', { day:'numeric',month:'short',year:'numeric' })}</td>
                  <td className="px-5 py-3"><span className={`badge ${c.is_blocked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>{c.is_blocked ? 'Blocked' : 'Active'}</span></td>
                  <td className="px-5 py-3"><button onClick={() => toggleBlock(c.id, c.is_blocked)} className="text-xs font-medium" style={{ color: c.is_blocked ? 'var(--crimson)' : '#6B7280' }}>{c.is_blocked ? 'Unblock' : 'Block'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-10 text-sm text-gray-400">{loading ? 'Loading...' : 'No customers found'}</p>}
        </div>
      </div>
    </AdminLayout>
  )
}
