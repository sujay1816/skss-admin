'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Lock, Shield, Users, Search, UserPlus, X } from 'lucide-react'

const ROLES = ['staff', 'admin', 'superadmin']

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  superadmin: { bg: '#FEF2F2', text: '#991B1B' },
  admin:      { bg: '#EFF6FF', text: '#1E40AF' },
  staff:      { bg: '#F3F4F6', text: '#374151' },
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin',
  admin:      'Admin',
  staff:      'Staff',
  manager:    'Admin',
}

export default function StaffPage() {
  const [staff, setStaff] = useState<any[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [checkingRole, setCheckingRole] = useState(true)
  const [showPromote, setShowPromote] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [promoting, setPromoting] = useState<string | null>(null)
  const [promoteRole, setPromoteRole] = useState('staff')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const { data: profile } = await supabase.from('profiles')
          .select('role').eq('id', user.id).single()
        setIsSuperAdmin(profile?.role === 'superadmin')
      }
      setCheckingRole(false)
      const { data } = await supabase.from('profiles')
        .select('*')
        .in('role', ['staff', 'admin', 'superadmin', 'manager'])
        .order('created_at')
      setStaff(data || [])
    }
    load()
  }, [])

  const changeRole = async (id: string, role: string) => {
    if (!isSuperAdmin) { toast.error('Only superadmin can change roles'); return }
    if (id === currentUserId) { toast.error('You cannot change your own role'); return }
    await supabase.from('profiles').update({ role }).eq('id', id)
    if (role === 'customer') {
      setStaff(prev => prev.filter(s => s.id !== id))
      toast.success('Access revoked — moved back to customer')
    } else {
      setStaff(prev => prev.map(s => s.id === id ? { ...s, role } : s))
      toast.success(`Role updated to ${ROLE_LABELS[role] || role}`)
    }
  }

  const searchCustomers = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    const { data } = await supabase.from('profiles')
      .select('id, full_name, email, phone, created_at')
      .eq('role', 'customer')
      .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
      .limit(10)
    setSearchResults(data || [])
    setSearching(false)
    if (!data || data.length === 0) toast('No customers found', { icon: '🔍' })
  }

  const promoteCustomer = async (customer: any) => {
    setPromoting(customer.id)
    await supabase.from('profiles').update({ role: promoteRole }).eq('id', customer.id)
    toast.success(`${customer.full_name || customer.email} promoted to ${ROLE_LABELS[promoteRole]}!`)
    setStaff(prev => [...prev, { ...customer, role: promoteRole }])
    setSearchResults(prev => prev.filter(c => c.id !== customer.id))
    setPromoting(null)
  }

  if (checkingRole) return (
    <AdminLayout><div className="text-center py-20 text-sm text-gray-400">Loading...</div></AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your team's access levels.</p>
            {!isSuperAdmin && (
              <div className="mt-3 flex items-center gap-2 p-3 rounded-lg" style={{ background: '#FEF9C3', border: '1px solid #FDE68A' }}>
                <Lock size={14} className="text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">Only a Superadmin can change roles.</p>
              </div>
            )}
          </div>
          {isSuperAdmin && (
            <button type="button" onClick={() => { setShowPromote(!showPromote); setSearchResults([]); setSearchQuery('') }}
              className="btn btn-primary flex items-center gap-2">
              <UserPlus size={16} /> Promote Customer
            </button>
          )}
        </div>

        {/* Promote Customer Panel */}
        {showPromote && isSuperAdmin && (
          <div className="card p-5 mb-6 border-2" style={{ borderColor: 'var(--crimson)' }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-900">Promote a Customer</h3>
              <button type="button" onClick={() => { setShowPromote(false); setSearchResults([]); setSearchQuery('') }}>
                <X size={18} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Search for any registered customer and give them admin panel access.
            </p>

            {/* Role picker */}
            <div className="mb-4">
              <label className="text-xs text-gray-600 font-medium mb-2 block">Assign role</label>
              <div className="flex gap-2">
                {(['staff', 'admin'] as const).map(r => (
                  <button key={r} type="button" onClick={() => setPromoteRole(r)}
                    className="flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all text-left"
                    style={{
                      borderColor: promoteRole === r ? ROLE_COLORS[r].text : '#E5E7EB',
                      background: promoteRole === r ? ROLE_COLORS[r].bg : 'white',
                      color: promoteRole === r ? ROLE_COLORS[r].text : '#6B7280',
                    }}>
                    <span className="block font-semibold">{ROLE_LABELS[r]}</span>
                    <span className="block text-xs font-normal mt-0.5" style={{ opacity: 0.7 }}>
                      {r === 'staff' ? 'View orders, manage products' : 'Full access except security'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchCustomers()}
                  placeholder="Search customer by name or email..." />
              </div>
              <button type="button" onClick={searchCustomers} disabled={searching} className="btn btn-secondary flex-shrink-0">
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Results */}
            {searchResults.length > 0 && (
              <div className="border rounded-lg divide-y" style={{ borderColor: '#E5E7EB' }}>
                {searchResults.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ background: 'var(--crimson)' }}>
                      {(c.full_name || c.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{c.full_name || '—'}</p>
                      <p className="text-xs text-gray-400">{c.email}</p>
                      {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                    </div>
                    <button type="button" onClick={() => promoteCustomer(c)}
                      disabled={promoting === c.id}
                      className="btn btn-primary text-xs flex-shrink-0" style={{ padding: '6px 14px' }}>
                      {promoting === c.id ? 'Promoting...' : `Make ${ROLE_LABELS[promoteRole]}`}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Role legend */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { role: 'staff', icon: Users, desc: 'View orders, manage products' },
            { role: 'admin', icon: Shield, desc: 'Full access except security settings' },
            { role: 'superadmin', icon: Lock, desc: 'Complete control including permissions' },
          ].map(({ role, icon: Icon, desc }) => (
            <div key={role} className="card p-3 text-center">
              <div className="w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2"
                style={{ background: ROLE_COLORS[role].bg }}>
                <Icon size={14} style={{ color: ROLE_COLORS[role].text }} />
              </div>
              <p className="text-xs font-semibold" style={{ color: ROLE_COLORS[role].text }}>{ROLE_LABELS[role]}</p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>

        {/* Staff list */}
        <div className="card divide-y divide-gray-100">
          {staff.length === 0 && <p className="text-center py-10 text-sm text-gray-400">No staff accounts yet — use Promote Customer above to add your first staff member.</p>}
          {staff.map(s => (
            <div key={s.id} className="flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: ROLE_COLORS[s.role]?.text || '#6B7280' }}>
                {(s.full_name || s.email || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 truncate">{s.full_name || '—'}</p>
                  {s.id === currentUserId && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex-shrink-0">You</span>}
                </div>
                <p className="text-xs text-gray-400 truncate">{s.email}</p>
              </div>
              {isSuperAdmin && s.id !== currentUserId ? (
                <select className="input" style={{ width: 160, height: 36, fontSize: 13 }}
                  value={s.role} onChange={e => changeRole(s.id, e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                  <option value="customer">Revoke Access</option>
                </select>
              ) : (
                <span className="text-xs px-3 py-1.5 rounded-full font-medium"
                  style={{ background: ROLE_COLORS[s.role]?.bg || '#F3F4F6', color: ROLE_COLORS[s.role]?.text || '#374151' }}>
                  {ROLE_LABELS[s.role] || s.role}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
