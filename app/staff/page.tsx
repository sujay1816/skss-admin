'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Lock, Shield, Users } from 'lucide-react'

// Updated role names — superadmin, admin, staff
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
  // legacy mapping in case old DB values exist
  manager:    'Admin',
}

export default function StaffPage() {
  const [staff, setStaff] = useState<any[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [checkingRole, setCheckingRole] = useState(true)

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
      // Fetch all staff — include 'manager' for legacy accounts
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
    } else {
      setStaff(prev => prev.map(s => s.id === id ? { ...s, role } : s))
    }
    toast.success('Role updated')
  }

  if (checkingRole) return (
    <AdminLayout>
      <div className="text-center py-20 text-sm text-gray-400">Loading...</div>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your team's access levels. To add new staff, they must first create an account on the storefront.
          </p>
          {!isSuperAdmin && (
            <div className="mt-3 flex items-center gap-2 p-3 rounded-lg" style={{ background: '#FEF9C3', border: '1px solid #FDE68A' }}>
              <Lock size={14} className="text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">You can view staff accounts but only a Superadmin can change roles.</p>
            </div>
          )}
        </div>

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
              <p className="text-xs font-semibold" style={{ color: ROLE_COLORS[role].text }}>
                {ROLE_LABELS[role]}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>

        <div className="card divide-y divide-gray-100">
          {staff.length === 0 && (
            <p className="text-center py-10 text-sm text-gray-400">No staff accounts yet</p>
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
                <p className="text-xs text-gray-400 truncate">{s.email}</p>
              </div>
              {isSuperAdmin && s.id !== currentUserId ? (
                <select className="input" style={{ width: 160, height: 36, fontSize: 13 }}
                  value={s.role} onChange={e => changeRole(s.id, e.target.value)}>
                  {ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                  ))}
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

        <div className="card p-4 mt-4" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
          <p className="text-xs font-semibold text-amber-800 mb-1">To promote a customer to staff:</p>
          <p className="text-xs text-amber-700 font-mono">UPDATE profiles SET role = 'staff' WHERE email = 'their@email.com'</p>
          <p className="text-xs text-amber-600 mt-1">Run this in Supabase Dashboard → SQL Editor</p>
        </div>
      </div>
    </AdminLayout>
  )
}
