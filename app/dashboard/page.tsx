'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { ShoppingBag, Users, Package, TrendingUp, Clock, Check, Truck } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const STATUS_COLORS: Record<string, string> = {
  confirmed:        '#059669',
  shipped:          '#D97706',
  delivered:        '#16A34A',
  cancelled:        '#DC2626',
  pending:          '#D97706',
  return_requested: '#7C3AED',
  return_approved:  '#1565C0',
  return_rejected:  '#DC2626',
  refunded:         '#059669',
}

export default function DashboardPage() {
  // Show access denied toast when redirected from a restricted page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('error') === 'access_denied') {
        toast.error('You do not have permission to access that page.')
        window.history.replaceState({}, '', '/dashboard')
      }
    }
  }, [])

  const [stats, setStats] = useState({ totalOrders: 0, todayOrders: 0, totalRevenue: 0, totalCustomers: 0, pendingOrders: 0, shippedOrders: 0, deliveredOrders: 0, totalProducts: 0 })
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0]
      const [ordersRes, todayOrdersRes, revenueRes, customersRes, pendingRes, shippedRes, deliveredRes, productsRes, recentRes] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', today),
        supabase.rpc('get_total_revenue').maybeSingle(),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),

        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'shipped'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'delivered'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('orders').select('*, profiles(full_name, email)').order('created_at', { ascending: false }).limit(8),
      ])
      const totalRevenue = Number((revenueRes.data as any)?.sum || 0)
      setStats({ totalOrders: ordersRes.count || 0, todayOrders: todayOrdersRes.count || 0, totalRevenue, totalCustomers: customersRes.count || 0, pendingOrders: pendingRes.count || 0, shippedOrders: shippedRes.count || 0, deliveredOrders: deliveredRes.count || 0, totalProducts: productsRes.count || 0 })
      setRecentOrders(recentRes.data || [])
      setLoading(false)
    }
    load()
  }, [])
  return (
    <AdminLayout>
      <div>
        <div className="flex items-center justify-between mb-8">
          <div><h1 className="text-2xl font-bold text-gray-900">Dashboard</h1><p className="text-sm text-gray-500 mt-0.5">Welcome back! Here's what's happening.</p></div>
          <Link href="/products/new" className="btn btn-primary">+ New Product</Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Orders', value: stats.totalOrders, sub: `${stats.todayOrders} today`, icon: ShoppingBag, color: '#8B1A2B' },
            { label: 'Revenue', value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`, sub: 'Paid orders only', icon: TrendingUp, color: '#C9A84C' },
            { label: 'Customers', value: stats.totalCustomers, sub: 'Registered users', icon: Users, color: '#3B82F6' },
            { label: 'Products', value: stats.totalProducts, sub: 'Active listings', icon: Package, color: '#10B981' },
          ].map((s, i) => (
            <div key={i} className="card p-5">
              <div className="flex items-start justify-between">
                <div><p className="text-xs text-gray-500 font-medium">{s.label}</p><p className="text-2xl font-bold mt-1 text-gray-900">{s.value}</p><p className="text-xs text-gray-400 mt-0.5">{s.sub}</p></div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: s.color + '15' }}><s.icon size={20} style={{ color: s.color }} /></div>
              </div>
            </div>
          ))}
        </div>

        {/* Order pipeline */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Pending', value: stats.pendingOrders, icon: Clock, color: '#F59E0B', href: '/orders?status=confirmed' },
            { label: 'Shipped', value: stats.shippedOrders, icon: Truck, color: '#3B82F6', href: '/orders?status=shipped' },
            { label: 'Delivered', value: stats.deliveredOrders, icon: Check, color: '#10B981', href: '/orders?status=delivered' },
          ].map((s, i) => (
            <Link key={i} href={s.href} className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: s.color + '20' }}><s.icon size={18} style={{ color: s.color }} /></div>
              <div><p className="text-2xl font-bold text-gray-900">{s.value}</p><p className="text-xs text-gray-500">{s.label}</p></div>
            </Link>
          ))}
        </div>

        {/* Recent orders */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Orders</h2>
            <Link href="/orders" className="text-xs font-medium" style={{ color: 'var(--crimson)' }}>View All</Link>
          </div>
          {/* Mobile recent orders */}
          <div className="md:hidden divide-y divide-gray-100">
            {recentOrders.map(o => (
              <div key={o.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-mono text-xs font-semibold" style={{ color: 'var(--crimson)' }}>
                    {o.order_number || `#${o.id.slice(0,8).toUpperCase()}`}
                  </p>
                  <p className="font-medium text-gray-900 text-sm">{o.profiles?.full_name || '—'}</p>
                  <p className="text-xs text-gray-400">₹{Number(o.total_amount).toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <span className="badge text-white text-xs capitalize" style={{ background: STATUS_COLORS[o.status] || '#6B7280' }}>
                    {o.status.replace('_',' ')}
                  </span>
                  <div className="mt-1">
                    <a href={`/orders/${o.id}`} className="text-xs font-medium" style={{ color: 'var(--crimson)' }}>View →</a>
                  </div>
                </div>
              </div>
            ))}
            {recentOrders.length === 0 && <p className="text-center py-8 text-sm text-gray-400">No orders yet</p>}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">{['Order #','Customer','Amount','Status','Date','Action'].map(h => <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {recentOrders.map(o => (
                  <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    {/* Issue 10 fix — fallback to id if order_number is null */}
                    <td className="px-5 py-3 font-mono font-semibold text-xs" style={{ color: 'var(--crimson)' }}>
                      {o.order_number || `#${o.id.slice(0,8).toUpperCase()}`}
                    </td>
                    <td className="px-5 py-3"><p className="font-medium text-gray-900">{o.profiles?.full_name || '—'}</p><p className="text-xs text-gray-400">{o.profiles?.email}</p></td>
                    <td className="px-5 py-3 font-semibold text-gray-900">₹{Number(o.total_amount).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3"><span className="badge text-white text-xs capitalize" style={{ background: STATUS_COLORS[o.status] || '#6B7280' }}>{o.status.replace('_',' ')}</span></td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{new Date(o.created_at).toLocaleDateString('en-IN', { day:'numeric',month:'short',hour:'2-digit',minute:'2-digit' })}</td>
                    <td className="px-5 py-3"><Link href={`/orders/${o.id}`} className="text-xs font-medium" style={{ color: 'var(--crimson)' }}>View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recentOrders.length === 0 && <p className="text-center py-8 text-sm text-gray-400">No orders yet</p>}
         </div>
        </div>
      </div>
    </AdminLayout>
  )
}
