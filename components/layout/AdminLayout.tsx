'use client'
import React from 'react'
import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import { supabase } from '@/lib/supabase'


// FIX: Error boundary — catches any JS error in admin pages and shows a
// graceful fallback instead of a blank white screen.
interface EBState { hasError: boolean; message: string }
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, message: '' }
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, message: error.message }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Admin panel error:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'sans-serif' }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{ fontSize: 40, marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ marginBottom: '.5rem', color: '#1A1A1A' }}>Something went wrong</h2>
            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: '1.5rem' }}>{this.state.message || 'An unexpected error occurred.'}</p>
            <button
              onClick={() => { this.setState({ hasError: false, message: '' }); window.location.reload() }}
              style={{ background: '#8B1A2B', color: 'white', border: 'none', borderRadius: 6, padding: '8px 20px', cursor: 'pointer', fontSize: 14 }}>
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const load = async () => {
      const { count } = await supabase.from('admin_notifications')
        .select('*', { count: 'exact', head: true }).eq('is_read', false)
      setUnreadCount(count || 0)
    }
    load()
    const channel = supabase.channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, () => { load() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <ErrorBoundary>
    <div className="flex min-h-screen">
      <Sidebar unreadCount={unreadCount} />
      {/* Fix #21 — main content offset on mobile to account for top header */}
      <main className="flex-1 overflow-x-hidden md:ml-0">
        {/* Mobile top bar — visible only on mobile */}
        <div className="md:hidden h-14 flex items-center px-4 border-b sticky top-0 z-30 bg-white"
          style={{ borderColor: '#E5E7EB' }}>
          {/* Spacer for hamburger button which is fixed */}
          <div className="w-10" />
          <p className="text-sm font-semibold text-gray-800 mx-auto">Admin Panel</p>
          {unreadCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <div className="p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  </ErrorBoundary>
  )
}