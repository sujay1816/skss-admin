'use client'
import { useState, useEffect } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { AlertTriangle, RotateCcw, Lock } from 'lucide-react'

const RESET_OPTIONS = [
  { key: 'variants', label: 'All Variants Stock → 0', desc: 'Sets stock to 0 for all colour variants of all products', danger: true },
  { key: 'products', label: 'All Products Stock → 0', desc: 'Sets stock to 0 in products table for all products', danger: true },
  { key: 'carts', label: 'All Carts → Empty', desc: 'Clears all customer cart items', danger: true },
  { key: 'orders', label: 'All Test Orders → Delete', desc: 'Deletes all orders and order items (use for test data cleanup only)', danger: true },
]

export default function ResetPage() {
  const [selected, setSelected] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [done, setDone] = useState<string[]>([])
  // Security fix — check if current user is superadmin
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [checkingRole, setCheckingRole] = useState(true)

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setCheckingRole(false); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setIsSuperAdmin(profile?.role === 'superadmin')
      setCheckingRole(false)
    }
    checkRole()
  }, [])

  const toggle = (key: string) =>
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

  const handleReset = async () => {
    if (confirmText !== 'RESET') { toast.error('Please type RESET to confirm'); return }
    if (!isSuperAdmin) { toast.error('Access denied'); return }
    setLoading(true)
    const completed: string[] = []
    try {
      if (selected.includes('variants')) {
        await supabase.from('product_variants').update({ stock: 0 }).gte('stock', 0)
        completed.push('Variants stock reset to 0')
      }
      if (selected.includes('products')) {
        await supabase.from('products').update({ stock: 0 }).gte('stock', 0)
        completed.push('Products stock reset to 0')
      }
      if (selected.includes('carts')) {
        await supabase.from('carts').delete().gte('quantity', 0)
        completed.push('All carts cleared')
      }
      if (selected.includes('orders')) {
        await supabase.from('order_items').delete().gte('quantity', 0)
        await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        completed.push('All orders deleted')
      }
      setDone(completed)
      toast.success('Reset completed!')
      setSelected([]); setConfirming(false); setConfirmText('')
    } catch (error: any) {
      toast.error('Reset failed: ' + error.message)
    }
    setLoading(false)
  }

  if (checkingRole) return (
    <AdminLayout>
      <div className="text-center py-20 text-sm text-gray-400">Checking permissions...</div>
    </AdminLayout>
  )

  // Security fix — block non-superadmin users entirely
  if (!isSuperAdmin) return (
    <AdminLayout>
      <div className="max-w-2xl">
        <div className="card p-10 text-center">
          <Lock size={48} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-sm text-gray-500">This page is only accessible to Superadmin accounts.</p>
          <p className="text-xs text-gray-400 mt-2">Contact your superadmin if you need access.</p>
        </div>
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-2">
          <RotateCcw size={24} style={{ color: 'var(--crimson)' }} />
          <h1 className="text-2xl font-bold text-gray-900">Reset Data</h1>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Superadmin Only</span>
        </div>
        <p className="text-sm text-gray-500 mb-6">Select what you want to reset. Useful for clearing test data before going live.</p>

        <div className="flex items-start gap-3 p-4 rounded-lg mb-6" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
          <AlertTriangle size={20} style={{ color: '#DC2626', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#991B1B' }}>Warning — Cannot be undone</p>
            <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>These actions permanently modify your data. Only use this to clean up test data before going live with real customers.</p>
          </div>
        </div>

        {done.length > 0 && (
          <div className="p-4 rounded-lg mb-6" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: '#15803D' }}>✅ Completed:</p>
            {done.map((d, i) => <p key={i} className="text-xs" style={{ color: '#166534' }}>• {d}</p>)}
          </div>
        )}

        <div className="space-y-3 mb-6">
          {RESET_OPTIONS.map(opt => (
            <label key={opt.key}
              className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all"
              style={{ borderColor: selected.includes(opt.key) ? '#DC2626' : '#E5E7EB', background: selected.includes(opt.key) ? '#FEF2F2' : 'white' }}>
              <input type="checkbox" checked={selected.includes(opt.key)} onChange={() => toggle(opt.key)} className="mt-0.5" style={{ accentColor: '#DC2626' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#991B1B' }}>{opt.label}</p>
                <p className="text-xs mt-0.5 text-gray-500">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {selected.length > 0 && !confirming && (
          <button type="button" onClick={() => setConfirming(true)} className="w-full py-3 text-sm font-medium text-white rounded-lg" style={{ background: '#DC2626' }}>
            Proceed with Reset ({selected.length} selected)
          </button>
        )}

        {confirming && (
          <div className="p-5 border rounded-lg" style={{ borderColor: '#DC2626', background: '#FEF2F2' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#991B1B' }}>Final Confirmation</p>
            <p className="text-xs mb-3" style={{ color: '#B91C1C' }}>Type <strong>RESET</strong> below to confirm:</p>
            <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="Type RESET here" className="input mb-3" style={{ borderColor: '#DC2626' }} />
            <div className="flex gap-3">
              <button type="button" onClick={() => { setConfirming(false); setConfirmText('') }} className="flex-1 py-2.5 text-sm font-medium rounded-lg border" style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}>Cancel</button>
              <button type="button" onClick={handleReset} disabled={loading || confirmText !== 'RESET'} className="flex-1 py-2.5 text-sm font-medium text-white rounded-lg" style={{ background: confirmText === 'RESET' ? '#DC2626' : '#FCA5A5', cursor: confirmText === 'RESET' ? 'pointer' : 'not-allowed' }}>
                {loading ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
