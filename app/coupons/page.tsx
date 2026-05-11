'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Tag, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<any[]>([])
  const [showNew, setShowNew] = useState(false)
  const [canManage, setCanManage] = useState(false)
  const [form, setForm] = useState({
    code: '', type: 'percentage', value: '', minOrderValue: '',
    maxUsageCount: '100', perUserLimit: '1', expiryDate: '', isActive: true
  })

  useEffect(() => {
    supabase.from('coupons').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setCoupons(data || []))
    // Fix #5 — only manager/superadmin can manage coupons
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('role').eq('id', user.id).single()
          .then(({ data }) => setCanManage(['manager','superadmin'].includes(data?.role || '')))
      }
    })
  }, [])

  const save = async () => {
    if (!canManage) { toast.error('Only managers can create coupons'); return }
    if (!form.code || !form.value) { toast.error('Code and value required'); return }
    const { data, error } = await supabase.from('coupons').insert({
      code: form.code.toUpperCase(), type: form.type, value: Number(form.value),
      min_order_value: Number(form.minOrderValue) || 0,
      max_usage_count: Number(form.maxUsageCount) || 100,
      per_user_limit: Number(form.perUserLimit) || 1,
      expiry_date: form.expiryDate || null, is_active: form.isActive
    }).select().single()
    if (error) { toast.error(error.message); return }
    setCoupons(prev => [data, ...prev])
    setShowNew(false)
    setForm({ code: '', type: 'percentage', value: '', minOrderValue: '', maxUsageCount: '100', perUserLimit: '1', expiryDate: '', isActive: true })
    toast.success('Coupon created!')
  }

  const toggle = async (id: string, active: boolean) => {
    if (!canManage) { toast.error('Only managers can modify coupons'); return }
    await supabase.from('coupons').update({ is_active: !active }).eq('id', id)
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, is_active: !active } : c))
  }

  const del = async (id: string) => {
    if (!canManage) { toast.error('Only managers can delete coupons'); return }
    if (!confirm('Delete this coupon?')) return
    await supabase.from('coupons').delete().eq('id', id)
    setCoupons(prev => prev.filter(c => c.id !== id))
    toast.success('Coupon deleted')
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>
            {!canManage && (
              <div className="flex items-center gap-1.5 mt-1">
                <Lock size={12} className="text-amber-500" />
                <p className="text-xs text-amber-600">View only — managers can create/delete coupons</p>
              </div>
            )}
          </div>
          {canManage && (
            <button type="button" onClick={() => setShowNew(!showNew)} className="btn btn-primary">
              <Plus size={16} /> New Coupon
            </button>
          )}
        </div>

        {/* Fix #18 — mobile-friendly form */}
        {showNew && canManage && (
          <div className="card p-5 mb-5">
            <h3 className="font-semibold mb-4">New Coupon</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Code (e.g. SILK20)</label>
                <input className="input" value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="SILK20" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Type</label>
                <select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="flat">Flat (₹)</option>
                  <option value="free_shipping">Free Shipping</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Value</label>
                <input className="input" type="number" value={form.value}
                  onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                  placeholder={form.type === 'percentage' ? '20' : '500'} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Min Order (₹)</label>
                <input type="number" className="input" value={form.minOrderValue}
                  onChange={e => setForm(p => ({ ...p, minOrderValue: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Max Uses</label>
                <input type="number" className="input" value={form.maxUsageCount}
                  onChange={e => setForm(p => ({ ...p, maxUsageCount: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Per User Limit</label>
                <input type="number" className="input" value={form.perUserLimit}
                  onChange={e => setForm(p => ({ ...p, perUserLimit: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Expiry Date</label>
                <input type="date" className="input" value={form.expiryDate}
                  onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))} />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={form.isActive}
                    onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                    style={{ accentColor: 'var(--crimson)' }} />
                  Active immediately
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={save} className="btn btn-primary">Create Coupon</button>
              <button type="button" onClick={() => setShowNew(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        <div className="card divide-y divide-gray-100">
          {coupons.length === 0 && <p className="text-center py-10 text-sm text-gray-400">No coupons yet</p>}
          {coupons.map(c => (
            <div key={c.id} className="flex items-start sm:items-center gap-4 px-4 sm:px-5 py-4 hover:bg-gray-50 flex-col sm:flex-row">
              <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--cream)' }}>
                <Tag size={16} style={{ color: 'var(--crimson)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-gray-900">{c.code}</span>
                  {!c.is_active && <span className="badge bg-gray-100 text-gray-500">Inactive</span>}
                  {c.expiry_date && new Date(c.expiry_date) < new Date() && <span className="badge bg-red-100 text-red-600">Expired</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {c.type === 'percentage' ? `${c.value}% off` : c.type === 'free_shipping' ? 'Free Shipping' : `₹${c.value} off`}
                  {' · '}Min ₹{c.min_order_value}
                  {' · '}{c.usage_count}/{c.max_usage_count} used
                  {c.expiry_date && ` · Expires ${new Date(c.expiry_date).toLocaleDateString('en-IN')}`}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2 flex-shrink-0">
                  <button type="button" onClick={() => toggle(c.id, c.is_active)} className="btn btn-secondary text-xs">
                    {c.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button type="button" onClick={() => del(c.id)} className="p-1.5 hover:bg-red-50 rounded">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
