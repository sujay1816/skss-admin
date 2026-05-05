'use client'
import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) { toast.error(error.message); setLoading(false); return }
  
  // Wait a moment for session to be established
  await new Promise(r => setTimeout(r, 500))
  
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
  
  if (!profile) {
    // Profile not found - check if user exists in auth but not profiles
    toast.error('Profile not found. Please sign up on the storefront first.')
    await supabase.auth.signOut()
    setLoading(false); return
  }
  
  if (!['staff','manager','superadmin'].includes(profile.role)) {
    await supabase.auth.signOut()
    toast.error('Access denied. Admin accounts only.')
    setLoading(false); return
  }
  
  router.push('/dashboard')
}

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #2C1810 100%)' }}>
      <div className="w-full max-w-sm p-8 bg-white rounded-xl shadow-2xl">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="SKSS" width={60} height={60} className="mx-auto mb-3 object-contain" />
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Admin Panel</h1>
          <p className="text-xs text-gray-500 mt-1">Sai Krishna Silks & Sarees</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div><label className="text-xs text-gray-600 mb-1 block">Email</label><input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></div>
          <div><label className="text-xs text-gray-600 mb-1 block">Password</label><input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center">{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>
      </div>
    </div>
  )
}
