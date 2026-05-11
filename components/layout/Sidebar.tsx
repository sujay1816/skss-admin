'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, ShoppingBag, Users, Tag, RotateCcw, Image as ImgIcon, UserCog, FolderOpen, Settings, LogOut, Bell, Menu, X, BarChart2, PackagePlus, RefreshCcw, FileText, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Bulk Add', href: '/products/bulk', icon: PackagePlus },
  { label: 'Stock', href: '/stock', icon: BarChart2 },
  { label: 'Orders', href: '/orders', icon: ShoppingBag },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Coupons', href: '/coupons', icon: Tag },
  { label: 'Returns', href: '/returns', icon: RotateCcw },
  { label: 'Reviews', href: '/reviews', icon: Star },
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Banners', href: '/banners', icon: ImgIcon },
  { label: 'Categories', href: '/categories', icon: FolderOpen },
  { label: 'Staff', href: '/staff', icon: UserCog },
  { label: 'Pages', href: '/pages', icon: FileText },
  { label: 'Config', href: '/config', icon: Settings },
  { label: 'Reset Data', href: '/reset', icon: RefreshCcw },
]

export default function Sidebar({ unreadCount }: { unreadCount?: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [brandName, setBrandName] = useState('SKSS')
  const [brandSubtitle, setBrandSubtitle] = useState('Admin Panel')
  const [logoUrl, setLogoUrl] = useState('/logo.png')

  useEffect(() => {
    supabase.from('site_config')
      .select('key, value')
      .in('key', ['brand_name', 'brand_subtitle', 'logo_url'])
      .then(({ data }) => {
        if (!data) return
        const cfg: Record<string, string> = {}
        data.forEach((r: any) => { if (r.value) cfg[r.key] = r.value })
        if (cfg.brand_name) setBrandName(cfg.brand_name)
        if (cfg.brand_subtitle) setBrandSubtitle(cfg.brand_subtitle)
        if (cfg.logo_url) setLogoUrl(cfg.logo_url)
      })
  }, [])

  const logout = async () => {
    await supabase.auth.signOut({ scope: 'global' } as any)
    router.push('/login')
  }

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10 flex items-center gap-3">
        <Image src={logoUrl} alt={brandName} width={32} height={32} className="object-contain rounded" />
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold leading-tight truncate">{brandName}</p>
          <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{brandSubtitle}</p>
        </div>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/products' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded transition-all text-sm mb-0.5 ${active ? 'text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
              style={{ background: active ? 'var(--crimson, #8B1A2B)' : 'transparent' }}>
              <Icon size={16} /> {label}
              {label === 'Notifications' && unreadCount && unreadCount > 0 ? (
                <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <button onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all">
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      <button className="fixed top-4 left-4 z-50 md:hidden p-2 rounded bg-gray-900 text-white"
        onClick={() => setOpen(!open)}>
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}
          style={{ background: 'rgba(0,0,0,0.5)' }} />
      )}
      <div className={`fixed left-0 top-0 bottom-0 z-40 w-56 md:hidden transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: '#1A1A1A' }}>
        <NavContent />
      </div>
      <div className="hidden md:flex flex-col w-56 flex-shrink-0 h-screen sticky top-0"
        style={{ background: '#1A1A1A' }}>
        <NavContent />
      </div>
    </>
  )
}
