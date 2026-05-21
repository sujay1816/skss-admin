'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, ShoppingBag, Users, Tag, RotateCcw,
  Image as ImgIcon, UserCog, FolderOpen, Settings, LogOut, Bell,
  Menu, X, BarChart2, PackagePlus, RefreshCcw, FileText, Star,
  ShieldCheck, ChevronDown, ChevronRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// NAV groups with permission keys — controls which roles see which links
// permission: null means visible to all roles
// permission: 'key' means only visible if role has that permission OR is superadmin
const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard',    href: '/dashboard',     icon: LayoutDashboard, permission: null },
      { label: 'Orders',       href: '/orders',        icon: ShoppingBag,     permission: 'orders_view' },
      { label: 'Returns',      href: '/returns',       icon: RotateCcw,       permission: 'returns' },
    ]
  },
  {
    label: 'Catalogue',
    items: [
      { label: 'Products',     href: '/products',      icon: Package,         permission: 'products_view' },
      { label: 'Bulk Add',     href: '/products/bulk', icon: PackagePlus,     permission: 'products_edit' },
      { label: 'Stock',        href: '/stock',         icon: BarChart2,       permission: 'stock' },
      { label: 'Categories',   href: '/categories',    icon: FolderOpen,      permission: 'categories' },
    ]
  },
  {
    label: 'Customers',
    items: [
      { label: 'Customers',    href: '/customers',     icon: Users,           permission: 'customers' },
      { label: 'Reviews',      href: '/reviews',       icon: Star,            permission: 'reviews' },
      { label: 'Coupons',      href: '/coupons',       icon: Tag,             permission: 'coupons' },
    ]
  },
  {
    label: 'Content',
    items: [
      { label: 'Banners',      href: '/banners',       icon: ImgIcon,         permission: 'banners' },
      { label: 'Pages',        href: '/pages',         icon: FileText,        permission: 'pages' },
    ]
  },
  {
    label: 'Settings',
    items: [
      { label: 'Notifications',href: '/notifications', icon: Bell,            permission: 'notifications' },
      { label: 'Staff',        href: '/staff',         icon: UserCog,         permission: 'staff' },
      { label: 'Permissions',  href: '/permissions',   icon: ShieldCheck,     permission: 'permissions' },
      { label: 'Config',       href: '/config',        icon: Settings,        permission: 'config' },
      { label: 'Reset Data',   href: '/reset',         icon: RefreshCcw,      permission: 'reset' },
    ]
  },
]

// Default permissions fallback — matches what's in site_config
const DEFAULT_PERMS: Record<string, Record<string, boolean>> = {
  staff: {
    dashboard: true, orders_view: true, returns: true,
    products_view: true, products_edit: true, stock: true, categories: false,
    customers: true, reviews: true, coupons: true,
    banners: false, pages: false,
    notifications: true, staff: false, permissions: false, config: false, reset: false,
  },
  admin: {
    dashboard: true, orders_view: true, returns: true,
    products_view: true, products_edit: true, stock: true, categories: true,
    customers: true, reviews: true, coupons: true,
    banners: true, pages: true,
    notifications: true, staff: true, permissions: false, config: true, reset: false,
  },
}

export default function Sidebar({ unreadCount }: { unreadCount?: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [brandName, setBrandName] = useState('SKSS')
  const [brandSubtitle, setBrandSubtitle] = useState('Admin Panel')
  const [logoUrl, setLogoUrl] = useState('/logo.png')
  const [userRole, setUserRole] = useState<string>('staff')
  const [permissions, setPermissions] = useState<Record<string, boolean>>(DEFAULT_PERMS.staff)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const load = async () => {
      // Load brand config
      const { data: cfg } = await supabase.from('site_config')
        .select('key, value')
        .in('key', ['brand_name', 'brand_subtitle', 'logo_url', 'role_permissions'])
      if (cfg) {
        const map: Record<string, string> = {}
        cfg.forEach((r: any) => { if (r.value) map[r.key] = r.value })
        if (map.brand_name) setBrandName(map.brand_name)
        if (map.brand_subtitle) setBrandSubtitle(map.brand_subtitle)
        if (map.logo_url) setLogoUrl(map.logo_url)

        // Load user role
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase.from('profiles')
            .select('role').eq('id', user.id).single()
          const role = profile?.role || 'staff'
          // Normalize legacy manager role
          const normalizedRole = role === 'manager' ? 'admin' : role
          setUserRole(normalizedRole)

          // Superadmin sees everything
          if (normalizedRole === 'superadmin') {
            const allPerms: Record<string, boolean> = {}
            NAV_GROUPS.forEach(g => g.items.forEach(item => {
              if (item.permission) allPerms[item.permission] = true
            }))
            setPermissions(allPerms)
          } else {
            // Load saved permissions or fall back to defaults
            if (map.role_permissions) {
              try {
                const saved = JSON.parse(map.role_permissions)
                setPermissions({ ...DEFAULT_PERMS[normalizedRole] || DEFAULT_PERMS.staff, ...saved[normalizedRole] })
              } catch {
                setPermissions(DEFAULT_PERMS[normalizedRole] || DEFAULT_PERMS.staff)
              }
            } else {
              setPermissions(DEFAULT_PERMS[normalizedRole] || DEFAULT_PERMS.staff)
            }
          }
        }
      }
    }
    load()
  }, [])

  const canSee = (permission: string | null): boolean => {
    if (!permission) return true
    if (userRole === 'superadmin') return true
    return permissions[permission] === true
  }

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const logout = async () => {
    await supabase.auth.signOut({ scope: 'global' } as any)
    router.push('/login')
  }

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand header */}
      <div className="p-4 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
        <Image src={logoUrl} alt={brandName} width={32} height={32}
          className="object-contain rounded flex-shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png' }} />
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold leading-tight truncate">{brandName}</p>
          <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{brandSubtitle}</p>
        </div>
      </div>

      {/* Role badge */}
      <div className="px-4 py-2 flex-shrink-0">
        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium capitalize"
          style={{
            background: userRole === 'superadmin' ? '#7F1D1D' : userRole === 'admin' ? '#1E3A8A' : '#374151',
            color: 'rgba(255,255,255,0.9)'
          }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          {userRole === 'manager' ? 'admin' : userRole}
        </span>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 py-1 overflow-y-auto">
        {NAV_GROUPS.map(group => {
          const visibleItems = group.items.filter(item => canSee(item.permission))
          if (visibleItems.length === 0) return null
          const isCollapsed = collapsedGroups[group.label]

          return (
            <div key={group.label} className="mb-1">
              {/* Group label — clickable to collapse */}
              <button type="button"
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-4 py-1.5 text-left"
                style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
                {group.label}
                {isCollapsed
                  ? <ChevronRight size={10} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  : <ChevronDown size={10} style={{ color: 'rgba(255,255,255,0.3)' }} />
                }
              </button>

              {!isCollapsed && visibleItems.map(({ label, href, icon: Icon, permission }) => {
                const active = pathname === href ||
                  (href !== '/products' && href !== '/dashboard' && pathname.startsWith(href))
                return (
                  <Link key={href} href={href} onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-all text-sm mb-0.5 ${active ? 'text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
                    style={{ background: active ? 'var(--crimson, #8B1A2B)' : 'transparent' }}>
                    <Icon size={15} className="flex-shrink-0" />
                    <span className="flex-1 truncate">{label}</span>
                    {label === 'Notifications' && unreadCount && unreadCount > 0 ? (
                      <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t border-white/10 flex-shrink-0">
        <button type="button" onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm transition-all"
          style={{ color: 'rgba(255,255,255,0.6)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = 'white' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)' }}>
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger — larger tap target */}
      <button type="button"
        className="fixed top-2.5 left-3 z-50 md:hidden flex items-center justify-center rounded-lg shadow-md"
        style={{ background: '#1A1A1A', color: 'white', width: 40, height: 40 }}
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close menu' : 'Open menu'}>
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden"
          onClick={() => setOpen(false)}
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} />
      )}

      {/* Mobile drawer */}
      <div className={`fixed left-0 top-0 bottom-0 z-40 w-60 md:hidden transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: '#1A1A1A' }}>
        <NavContent />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col w-56 flex-shrink-0 h-screen sticky top-0"
        style={{ background: '#1A1A1A' }}>
        <NavContent />
      </div>
    </>
  )
}
