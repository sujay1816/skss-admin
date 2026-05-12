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
      const { data } = await supabase.from('admin_notifications')
        .select('*').order('created_at', { ascending: false }).limit(100)
      setNotifications(data || [])
      setLoading(false)
      // Fix #10 — mark all as read after 2 seconds (gives admin time to see unread count)
      setTimeout(async () => {
        await supabase.from('admin_notifications').update({ is_read: true }).eq('is_read', false)
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      }, 2000)
    }
    load()
  }, [])

  // Fix #10 — mark individual notification as read on click
  const markRead = async (id: string) => {
    await supabase.from('admin_notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const clearAll = async () => {
    // Fix #10 — add confirmation before wiping all notifications
    if (!confirm('Clear all notifications? This cannot be undone.')) return
    await supabase.from('admin_notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setNotifications([])
    toast.success('All notifications cleared')
  }

  const unread = notifications.filter(n => !n.is_read).length

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500">
              {unread > 0 ? `${unread} unread · ` : ''}{notifications.length} total
            </p>
          </div>
          {notifications.length > 0 && (
            <button type="button" onClick={clearAll} className="btn btn-secondary text-xs">Clear All</button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--crimson)', borderTopColor: 'transparent' }} />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 card">
            <Bell size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400">No notifications</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => {
              const Icon = ICONS[n.type] || Bell
              const color = COLORS[n.type] || '#6B7280'
              const href = n.reference_type === 'order' ? `/orders/${n.reference_id}`
                : n.reference_type === 'product' ? `/products/${n.reference_id}` : '#'
              return (
                <div key={n.id}
                  className={`card p-4 flex items-start gap-4 transition-all ${!n.is_read ? 'border-l-4' : ''}`}
                  style={{ borderLeftColor: !n.is_read ? color : 'transparent', background: !n.is_read ? '#FAFAFA' : 'white' }}
                  onClick={() => !n.is_read && markRead(n.id)}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: color + '15' }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 text-sm">{n.title}</p>
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                      </div>
                      <p className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                        {new Date(n.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </p>
                    </div>
                    {n.reference_id && href !== '#' && (
                      <Link href={href} className="text-xs font-medium mt-2 inline-block" style={{ color }}>
                        View Details →
                      </Link>
                    )}
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
