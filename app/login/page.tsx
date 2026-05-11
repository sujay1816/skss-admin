'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [brandName, setBrandName] = useState('Sai Krishna Silks & Sarees')
  const [brandSubtitle, setBrandSubtitle] = useState('SILKS & SAREES')
  const [logoUrl, setLogoUrl] = useState('/logo.png')

  useEffect(() => {
    supabase.from('site_config').select('key, value').in('key', ['brand_name', 'brand_subtitle', 'logo_url'])
      .then(({ data }) => {
        if (!data) return
        const cfg: Record<string, string> = {}
        data.forEach((r: any) => { if (r.value) cfg[r.key] = r.value })
        if (cfg.brand_name) setBrandName(cfg.brand_name)
        if (cfg.brand_subtitle) setBrandSubtitle(cfg.brand_subtitle)
        if (cfg.logo_url) setLogoUrl(cfg.logo_url)
      })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { toast.error(error.message); setLoading(false); return }

    const { data: profile } = await supabase.from('profiles')
      .select('role, is_blocked')
      .eq('id', data.user.id)
      .maybeSingle()

    // Security fix — check role
    if (!profile || !['staff', 'manager', 'superadmin'].includes(profile.role)) {
      await supabase.auth.signOut()
      toast.error('Access denied. Admin accounts only.')
      setLoading(false); return
    }

    // Security fix — check if account is blocked
    if (profile.is_blocked) {
      await supabase.auth.signOut()
      toast.error('Your account has been suspended. Contact the superadmin.')
      setLoading(false); return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #2C1810 100%)' }}>
      <div className="w-full max-w-sm p-8 bg-white rounded-xl shadow-2xl">
        <div className="text-center mb-8">
          <Image src={logoUrl} alt={brandName} width={60} height={60} className="mx-auto mb-3 object-contain" />
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{brandName}</h1>
          <p className="text-xs text-gray-500 mt-1">{brandSubtitle} — Admin Panel</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Email</label>
            <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Password</label>
            <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
