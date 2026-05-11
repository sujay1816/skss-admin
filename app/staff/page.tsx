'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Lock } from 'lucide-react'

const ROLES = ['staff', 'manager', 'superadmin']

export default function StaffPage() {
  const [staff, setStaff] = useState<any[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [checkingRole, setCheckingRole] = useState(true)

  useEffect(() => {
    const load = async () => {
      // Security fix — get current user and verify superadmin
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setIsSuperAdmin(profile?.role === 'superadmin')
      }
      setCheckingRole(false)
      supabase.from('profiles').select('*').in('role', ROLES).order('created_at')
        .then(({ data }) => setStaff(data || []))
    }
    load()
  }, [])

  const changeRole = async (id: string, role: string) => {
    // Security fix — only superadmin can change roles
    if (!isSuperAdmin) { toast.error('Only superadmin can change roles'); return }
    // Security fix — cannot change your own role
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
          <p className="text-sm text-gray-500 mt-1">To add new staff, they must first create an account on the storefront, then upgrade their role here.</p>
          {!isSuperAdmin && (
            <div className="mt-3 flex items-center gap-2 p-3 rounded-lg" style={{ background: '#FEF9C3', border: '1px solid #FDE68A' }}>
              <Lock size={14} className="text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">You can view staff accounts but only a Superadmin can change roles.</p>
            </div>
          )}
        </div>

        <div className="card divide-y divide-gray-100">
          {staff.length === 0 && <p className="text-center py-10 text-sm text-gray-400">No staff accounts yet</p>}
          {staff.map(s => (
            <div key={s.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{s.full_name || '—'}</p>
                  {s.id === currentUserId && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">You</span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{s.email}</p>
              </div>
              {/* Security fix — only superadmin sees dropdown, and can't change own role */}
              {isSuperAdmin && s.id !== currentUserId ? (
                <select
                  className="input"
                  style={{ width: 160, height: 36, fontSize: 13 }}
                  value={s.role}
                  onChange={e => changeRole(s.id, e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  <option value="customer">Revoke Access (Customer)</option>
                </select>
              ) : (
                <span className="text-xs px-3 py-1.5 rounded-full font-medium capitalize"
                  style={{ background: s.role === 'superadmin' ? '#FEF2F2' : '#F3F4F6', color: s.role === 'superadmin' ? '#991B1B' : '#374151' }}>
                  {s.role}
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
