'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Lock, Shield, Users, Search, UserPlus, X, AlertTriangle } from 'lucide-react'

const ROLES = ['staff', 'admin']   // superadmin excluded from dropdown — can only be set manually in DB

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  superadmin: { bg: '#FEF2F2', text: '#991B1B' },
  admin:      { bg: '#EFF6FF', text: '#1E40AF' },
  staff:      { bg: '#F3F4F6', text: '#374151' },
  customer:   { bg: '#F0FDF4', text: '#166534' },
}
const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin', admin: 'Admin', staff: 'Staff', manager: 'Admin', customer: 'Customer',
}
const ROLE_DESCRIPTIONS: Record<string, string> = {
  staff: 'View orders, manage products and stock',
  admin: 'Full access except security settings',
  superadmin: 'Complete control including staff & permissions',
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
  const [promoteRole, setPromoteRole] = useState<'staff' | 'admin'>('staff')
  const [confirmChange, setConfirmChange] = useState<{ id: string; name: string; from: string; to: string } | null>(null)
  const [changingRole, setChangingRole] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setIsSuperAdmin(profile?.role === 'superadmin')
      }
      setCheckingRole(false)
      const { data } = await supabase.from('profiles')
        .select('id, full_name, email, phone, role, avatar_url, created_at')
        .in('role', ['staff', 'admin', 'superadmin', 'manager'])
        .order('created_at')
      setStaff(data || [])
    }
    load()
  }, [])

  const changeRole = async (id: string, newRole: string) => {
    if (!isSuperAdmin) { toast.error('Only superadmin can change roles'); return }
    if (id === currentUserId) { toast.error('You cannot change your own role'); return }
    const member = staff.find(s => s.id === id)
    if (!member) return
    // Show confirmation dialog before making the change
    setConfirmChange({ id, name: member.full_name || member.email || 'This user', from: member.role, to: newRole })
  }

  const confirmRoleChange = async () => {
    if (!confirmChange) return
    const { id, to } = confirmChange
    setChangingRole(id)
    setConfirmChange(null)
    try {
      const { error } = await supabase.from('profiles').update({ role: to }).eq('id', id)
      if (error) throw error
      if (to === 'customer') {
        setStaff(prev => prev.filter(s => s.id !== id))
        toast.success('Access revoked — moved back to customer')
      } else {
        setStaff(prev => prev.map(s => s.id === id ? { ...s, role: to } : s))
        toast.success(`Role updated to ${ROLE_LABELS[to] || to}`)
      }
    } catch (e: any) {
      toast.error('Failed to update role: ' + e.message)
    }
    setChangingRole(null)
  }

  const searchCustomers = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    // Search ALL profiles — not just role='customer', because new signups may have null role
    const { data } = await supabase.from('profiles')
      .select('id, full_name, email, phone, role, created_at')
      .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
      .not('role', 'in', '("staff","admin","superadmin","manager")')  // exclude existing staff
      .limit(10)
    setSearchResults(data || [])
    setSearching(false)
    if (!data || data.length === 0) toast('No customers found matching that search', { icon: '🔍' })
  }

  const promoteCustomer = async (customer: any) => {
    if (!isSuperAdmin) { toast.error('Only superadmin can promote users'); return }
    setPromoting(customer.id)
    try {
      const { error } = await supabase.from('profiles').update({ role: promoteRole }).eq('id', customer.id)
      if (error) throw error
      toast.success(`${customer.full_name || customer.email} promoted to ${ROLE_LABELS[promoteRole]}!`)
      setStaff(prev => [...prev, { ...customer, role: promoteRole }])
      setSearchResults(prev => prev.filter(c => c.id !== customer.id))
    } catch (e: any) {
      toast.error('Failed to promote: ' + e.message)
    }
    setPromoting(null)
  }

  if (checkingRole) return (
    <AdminLayout><div className="text-center py-20 text-sm text-gray-400">Loading...</div></AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        {/* Confirm dialog */}
        {confirmChange && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={18} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Confirm Role Change</h3>
                  <p className="text-xs text-gray-500">This will update their access immediately</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-4">
                Change <strong>{confirmChange.name}</strong> from{' '}
                <span className="font-medium" style={{ color: ROLE_COLORS[confirmChange.from]?.text }}>{ROLE_LABELS[confirmChange.from] || confirmChange.from}</span>{' '}
                to{' '}
                {confirmChange.to === 'customer'
                  ? <span className="font-medium text-red-600">Revoke Access (Customer)</span>
                  : <span className="font-medium" style={{ color: ROLE_COLORS[confirmChange.to]?.text }}>{ROLE_LABELS[confirmChange.to] || confirmChange.to}</span>
                }?
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setConfirmChange(null)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="button" onClick={confirmRoleChange}
                  className="flex-1 py-2 px-4 rounded text-sm font-medium text-white"
                  style={{ background: confirmChange.to === 'customer' ? '#DC2626' : 'var(--crimson)' }}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your team's access levels.</p>
            {!isSuperAdmin && (
              <div className="mt-3 flex items-center gap-2 p-3 rounded-lg" style={{ background: '#FEF9C3', border: '1px solid #FDE68A' }}>
                <Lock size={14} className="text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">View only — only a Superadmin can change roles.</p>
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

        {/* Promote Panel */}
        {showPromote && isSuperAdmin && (
          <div className="card p-5 mb-6 border-2" style={{ borderColor: 'var(--crimson)' }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-900">Promote a Customer</h3>
              <button type="button" onClick={() => { setShowPromote(false); setSearchResults([]); setSearchQuery('') }}>
                <X size={18} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Search any registered user and give them admin panel access.</p>

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
                    <span className="block text-xs font-normal mt-0.5" style={{ opacity: 0.7 }}>{ROLE_DESCRIPTIONS[r]}</span>
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
                  placeholder="Search by name or email..." />
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
                      <p className="text-xs text-gray-300">Current role: {ROLE_LABELS[c.role] || c.role || 'Customer'}</p>
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
          {([
            { role: 'staff',      icon: Users,  desc: ROLE_DESCRIPTIONS.staff },
            { role: 'admin',      icon: Shield, desc: ROLE_DESCRIPTIONS.admin },
            { role: 'superadmin', icon: Lock,   desc: ROLE_DESCRIPTIONS.superadmin },
          ] as { role: string; icon: any; desc: string }[]).map(({ role, icon: Icon, desc }) => (
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
          {staff.length === 0 && (
            <p className="text-center py-10 text-sm text-gray-400">
              No staff accounts yet — use Promote Customer above to add your first staff member.
            </p>
          )}
          {staff.map(s => (
            <div key={s.id} className="flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: ROLE_COLORS[s.role]?.text || '#6B7280' }}>
                {(s.full_name || s.email || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 truncate">{s.full_name || '—'}</p>
                  {s.id === currentUserId && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex-shrink-0">You</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate">{s.email || 'No email on file'}</p>
              </div>
              {isSuperAdmin && s.id !== currentUserId ? (
                <div className="flex items-center gap-2">
                  {changingRole === s.id ? (
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : null}
                  <select
                    className="input"
                    style={{ width: 170, height: 36, fontSize: 13, opacity: changingRole === s.id ? 0.5 : 1 }}
                    value={s.role}
                    disabled={changingRole === s.id}
                    onChange={e => changeRole(s.id, e.target.value)}
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                    ))}
                    {s.role === 'superadmin' && (
                      <option value="superadmin" disabled>Superadmin</option>
                    )}
                    <option value="customer">⛔ Revoke Access</option>
                  </select>
                </div>
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
