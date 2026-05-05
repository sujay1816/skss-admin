'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { Bell, Package, ShoppingBag, RotateCcw, Star, Users } from 'lucide-react'
import Link from 'next/link'

const ICONS: Record<string, any> = { new_order: ShoppingBag, low_stock: Package, return_request: RotateCcw, new_review: Star, new_customer: Users }
const COLORS: Record<string, string> = { new_order: '#8B1A2B', low_stock: '#D97706', return_request: '#7C3AED', new_review: '#C9A84C', new_customer: '#3B82F6' }

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('admin_notifications').select('*').order('created_at', { ascending: false }).limit(100)
      setNotifications(data || [])
      setLoading(false)
      // Mark all as read
      await supabase.from('admin_notifications').update({ is_read: true }).eq('is_read', false)
    }
    load()
  }, [])

  const clearAll = async () => {
    await supabase.from('admin_notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setNotifications([])
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-2xl font-bold text-gray-900">Notifications</h1><p className="text-sm text-gray-500">{notifications.length} total notifications</p></div>
          {notifications.length > 0 && <button onClick={clearAll} className="btn btn-secondary text-xs">Clear All</button>}
        </div>
        {loading ? <p className="text-sm text-gray-400">Loading...</p> : notifications.length === 0 ? (
          <div className="text-center py-16 card"><Bell size={40} className="mx-auto mb-3 text-gray-300" /><p className="text-gray-400">No notifications</p></div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => {
              const Icon = ICONS[n.type] || Bell
              const color = COLORS[n.type] || '#6B7280'
              const href = n.reference_type === 'order' ? `/orders/${n.reference_id}` : n.reference_type === 'product' ? `/products/${n.reference_id}` : '#'
              return (
                <div key={n.id} className={`card p-4 flex items-start gap-4 ${!n.is_read ? 'border-l-4' : ''}`} style={{ borderLeftColor: !n.is_read ? color : 'transparent' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: color + '15' }}><Icon size={16} style={{ color }} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{n.title}</p>
                        <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                      </div>
                      <p className="text-xs text-gray-400 flex-shrink-0">{new Date(n.created_at).toLocaleDateString('en-IN', { day:'numeric',month:'short',hour:'2-digit',minute:'2-digit' })}</p>
                    </div>
                    {n.reference_id && href !== '#' && <Link href={href} className="text-xs font-medium mt-2 inline-block" style={{ color }}>View Details →</Link>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
