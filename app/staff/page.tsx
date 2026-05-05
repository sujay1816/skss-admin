'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const ROLES = ['staff','manager','superadmin']

export default function StaffPage() {
  const [staff, setStaff] = useState<any[]>([])

  useEffect(() => {
    supabase.from('profiles').select('*').in('role', ROLES).order('created_at').then(({ data }) => setStaff(data || []))
  }, [])

  const changeRole = async (id: string, role: string) => {
    await supabase.from('profiles').update({ role }).eq('id', id)
    setStaff(prev => prev.map(s => s.id === id ? { ...s, role } : s))
    toast.success('Role updated')
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-sm text-gray-500 mt-1">To add new staff, they must first create an account on the storefront (skss.in), then you can upgrade their role here.</p>
        </div>
        <div className="card divide-y divide-gray-100">
          {staff.length === 0 && <p className="text-center py-10 text-sm text-gray-400">No staff accounts yet</p>}
          {staff.map(s => (
            <div key={s.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1"><p className="font-medium text-gray-900">{s.full_name || '—'}</p><p className="text-xs text-gray-400">{s.email}</p></div>
              <select className="input" style={{ width: 140, height: 36, fontSize: 13 }} value={s.role} onChange={e => changeRole(s.id, e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                <option value="customer">Revoke (Customer)</option>
              </select>
            </div>
          ))}
        </div>
        <div className="card p-4 mt-4" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
          <p className="text-xs font-semibold text-amber-800 mb-1">To promote a customer to staff:</p>
          <p className="text-xs text-amber-700">Run this SQL in Supabase: UPDATE profiles SET role = 'staff' WHERE email = 'their@email.com'</p>
        </div>
      </div>
    </AdminLayout>
  )
}
