'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Lock, Shield, Users, Save, RefreshCw } from 'lucide-react'

// All admin panel features that can be permission-controlled
const FEATURES = [
  { key: 'dashboard',   label: 'Dashboard',         desc: 'View sales stats and recent orders', group: 'Core' },
  { key: 'orders_view', label: 'View Orders',        desc: 'View all customer orders', group: 'Orders' },
  { key: 'orders_edit', label: 'Update Orders',      desc: 'Change order status, add tracking', group: 'Orders' },
  { key: 'products_view',   label: 'View Products',  desc: 'Browse product listings', group: 'Products' },
  { key: 'products_edit',   label: 'Edit Products',  desc: 'Add and edit products', group: 'Products' },
  { key: 'products_delete', label: 'Delete Products',desc: 'Permanently delete products', group: 'Products' },
  { key: 'stock',       label: 'Stock Management',   desc: 'Update product stock levels', group: 'Products' },
  { key: 'customers',   label: 'View Customers',     desc: 'See customer list and details', group: 'Customers' },
  { key: 'customers_block', label: 'Block Customers',desc: 'Block/unblock customer accounts', group: 'Customers' },
  { key: 'reviews',     label: 'Manage Reviews',     desc: 'Approve and delete customer reviews', group: 'Content' },
  { key: 'banners',     label: 'Manage Banners',     desc: 'Edit homepage hero banners', group: 'Content' },
  { key: 'categories',  label: 'Manage Categories',  desc: 'Add and edit product categories', group: 'Content' },
  { key: 'pages',       label: 'Edit Pages',         desc: 'Edit About, FAQ, Policy pages', group: 'Content' },
  { key: 'coupons',     label: 'View Coupons',       desc: 'See coupon list', group: 'Marketing' },
  { key: 'coupons_manage', label: 'Manage Coupons',  desc: 'Create, edit and delete coupons', group: 'Marketing' },
  { key: 'returns',     label: 'Manage Returns',     desc: 'Approve or reject return requests', group: 'Orders' },
  { key: 'notifications', label: 'Notifications',    desc: 'View admin notifications', group: 'Core' },
  { key: 'config',      label: 'Site Config',        desc: 'Edit brand, colors, integrations', group: 'Settings' },
  { key: 'staff',       label: 'Staff Management',   desc: 'View staff list', group: 'Settings' },
  { key: 'permissions', label: 'Permissions',        desc: 'Change role permissions (superadmin only)', group: 'Settings' },
  { key: 'reset',       label: 'Reset Data',         desc: 'Reset stock or delete test orders', group: 'Settings' },
]

const GROUPS = ['Core', 'Orders', 'Products', 'Customers', 'Content', 'Marketing', 'Settings']

// Default permissions for each role
const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  staff: {
    dashboard: true, orders_view: true, orders_edit: true,
    products_view: true, products_edit: true, products_delete: false,
    stock: true, customers: true, customers_block: false,
    reviews: true, banners: false, categories: false, pages: false,
    coupons: true, coupons_manage: false, returns: true,
    notifications: true, config: false, staff: false,
    permissions: false, reset: false,
  },
  admin: {
    dashboard: true, orders_view: true, orders_edit: true,
    products_view: true, products_edit: true, products_delete: true,
    stock: true, customers: true, customers_block: true,
    reviews: true, banners: true, categories: true, pages: true,
    coupons: true, coupons_manage: true, returns: true,
    notifications: true, config: true, staff: true,
    permissions: false, reset: false,
  },
  superadmin: {
    // Superadmin always has all permissions — cannot be changed
    dashboard: true, orders_view: true, orders_edit: true,
    products_view: true, products_edit: true, products_delete: true,
    stock: true, customers: true, customers_block: true,
    reviews: true, banners: true, categories: true, pages: true,
    coupons: true, coupons_manage: true, returns: true,
    notifications: true, config: true, staff: true,
    permissions: true, reset: true,
  },
}

export default function PermissionsPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeRole, setActiveRole] = useState<'staff' | 'admin'>('staff')
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>(DEFAULT_PERMISSIONS)

  useEffect(() => {
    const load = async () => {
      // Check superadmin
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setIsSuperAdmin(profile?.role === 'superadmin')
      }
      setChecking(false)

      // Load saved permissions from site_config
      const { data } = await supabase.from('site_config')
        .select('value').eq('key', 'role_permissions').maybeSingle()
      if (data?.value) {
        try {
          const saved = JSON.parse(data.value)
          // Merge with defaults so new features get default values
          setPermissions({
            staff: { ...DEFAULT_PERMISSIONS.staff, ...saved.staff },
            admin: { ...DEFAULT_PERMISSIONS.admin, ...saved.admin },
            superadmin: DEFAULT_PERMISSIONS.superadmin, // always locked
          })
        } catch {}
      }
    }
    load()
  }, [])

  const toggle = (role: 'staff' | 'admin', feature: string) => {
    if (!isSuperAdmin) return
    // Prevent toggling permissions feature for non-superadmin — always locked
    if (feature === 'permissions' || feature === 'reset') return
    setPermissions(prev => ({
      ...prev,
      [role]: { ...prev[role], [feature]: !prev[role][feature] }
    }))
  }

  const save = async () => {
    setSaving(true)
    const toSave = {
      staff: permissions.staff,
      admin: permissions.admin,
    }
    await supabase.from('site_config').upsert(
      { key: 'role_permissions', value: JSON.stringify(toSave) },
      { onConflict: 'key' }
    )
    toast.success('Permissions saved! Changes take effect on next page load.')
    setSaving(false)
  }

  const reset = () => {
    setPermissions(DEFAULT_PERMISSIONS)
    toast.success('Reset to defaults — click Save to apply')
  }

  if (checking) return (
    <AdminLayout>
      <div className="text-center py-20 text-sm text-gray-400">Checking permissions...</div>
    </AdminLayout>
  )

  if (!isSuperAdmin) return (
    <AdminLayout>
      <div className="max-w-2xl">
        <div className="card p-10 text-center">
          <Lock size={48} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Superadmin Only</h2>
          <p className="text-sm text-gray-500">Only superadmin accounts can manage role permissions.</p>
        </div>
      </div>
    </AdminLayout>
  )

  const currentPerms = permissions[activeRole] || {}

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Role Permissions</h1>
            <p className="text-sm text-gray-500 mt-0.5">Control what each role can access in the admin panel</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={reset} className="btn btn-secondary flex items-center gap-2">
              <RefreshCw size={14} /> Reset Defaults
            </button>
            <button type="button" onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2">
              <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Role selector */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { role: 'staff', label: 'Staff', icon: Users, desc: 'Basic access', color: '#374151', bg: '#F3F4F6' },
            { role: 'admin', label: 'Admin', icon: Shield, desc: 'Extended access', color: '#1E40AF', bg: '#EFF6FF' },
            { role: 'superadmin', label: 'Superadmin', icon: Lock, desc: 'Full access (locked)', color: '#991B1B', bg: '#FEF2F2' },
          ].map(({ role, label, icon: Icon, desc, color, bg }) => (
            <button key={role} type="button"
              onClick={() => role !== 'superadmin' && setActiveRole(role as 'staff' | 'admin')}
              disabled={role === 'superadmin'}
              className="card p-4 text-left transition-all"
              style={{
                borderColor: activeRole === role || role === 'superadmin' ? color : '#E5E7EB',
                borderWidth: activeRole === role ? 2 : 1,
                opacity: role === 'superadmin' ? 0.7 : 1,
                cursor: role === 'superadmin' ? 'default' : 'pointer',
              }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: bg }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </div>
              {role !== 'superadmin' && (
                <p className="text-xs text-gray-500">
                  {Object.values(permissions[role] || {}).filter(Boolean).length} / {FEATURES.length} features enabled
                </p>
              )}
              {role === 'superadmin' && (
                <p className="text-xs text-gray-400">All features always enabled</p>
              )}
            </button>
          ))}
        </div>

        
          <>
            <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' }}>
              Editing permissions for: <strong>{activeRole === 'staff' ? 'Staff' : 'Admin'}</strong> role.
              Toggle features on/off. Superadmin always has full access and cannot be restricted.
            </div>

            {GROUPS.map(group => {
              const groupFeatures = FEATURES.filter(f => f.group === group)
              return (
                <div key={group} className="card mb-4 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-semibold text-sm text-gray-700">{group}</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {groupFeatures.map(feature => {
                      const isLocked = feature.key === 'permissions' || feature.key === 'reset'
                      const enabled = isLocked ? false : (currentPerms[feature.key] ?? false)
                      return (
                        <div key={feature.key}
                          className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{feature.label}</p>
                            <p className="text-xs text-gray-400">{feature.desc}</p>
                          </div>
                          {isLocked ? (
                            <div className="flex items-center gap-2">
                              <Lock size={12} className="text-gray-300" />
                              <span className="text-xs text-gray-400">Superadmin only</span>
                            </div>
                          ) : (
                            <button type="button"
                              onClick={() => toggle(activeRole, feature.key)}
                              className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200"
                              style={{ background: enabled ? 'var(--crimson)' : '#D1D5DB' }}
                              role="switch" aria-checked={enabled}>
                              <span className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200"
                                style={{ transform: enabled ? 'translateX(20px)' : 'translateX(0px)' }} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <div className="flex justify-end mt-4">
              <button type="button" onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2">
                <Save size={14} /> {saving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </>  
      </div>
    </AdminLayout>
  )
}
