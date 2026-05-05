'use client'
import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import { supabase } from '@/lib/supabase'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const load = async () => {
      const { count } = await supabase.from('admin_notifications').select('*', { count: 'exact', head: true }).eq('is_read', false)
      setUnreadCount(count || 0)
    }
    load()
    // Real-time subscription
    const channel = supabase.channel('notifications').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, () => { load() }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="flex min-h-screen">
      <Sidebar unreadCount={unreadCount} />
      <main className="flex-1 overflow-x-hidden">
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  )
}
