'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Upload } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'

export default function BannersPage() {
  const [banners, setBanners] = useState<any[]>([])
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ imageUrl: '', heading: '', subheading: '', ctaLabel: 'Shop Now', ctaUrl: '/shop', isActive: true, displayOrder: 0 })
  const [uploading, setUploading] = useState(false)

  useEffect(() => { supabase.from('banners').select('*').order('display_order').then(({ data }) => setBanners(data || [])) }, [])

  const upload = async (file: File) => {
    setUploading(true)
    const { data: cfg } = await supabase.from('site_config').select('key,value').eq('key', 'cloudinary_cloud_name').single()
    if (!cfg?.value) { const url = URL.createObjectURL(file); setForm(p => ({ ...p, imageUrl: url })); setUploading(false); return }
    const fd = new FormData(); fd.append('file', file); fd.append('upload_preset', 'skss_banners')
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.value}/image/upload`, { method: 'POST', body: fd })
    const data = await res.json()
    setForm(p => ({ ...p, imageUrl: data.secure_url }))
    setUploading(false)
  }

  const save = async () => {
    if (!form.imageUrl) { toast.error('Please upload a banner image'); return }
    const { data } = await supabase.from('banners').insert({ image_url: form.imageUrl, heading: form.heading, subheading: form.subheading || null, cta_label: form.ctaLabel, cta_url: form.ctaUrl, is_active: form.isActive, display_order: banners.length + 1 }).select().single()
    setBanners(prev => [...prev, data])
    setShowNew(false); toast.success('Banner added!')
  }

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('banners').update({ is_active: !active }).eq('id', id)
    setBanners(prev => prev.map(b => b.id === id ? { ...b, is_active: !active } : b))
  }

  const del = async (id: string) => {
    if (!confirm('Delete this banner?')) return
    await supabase.from('banners').delete().eq('id', id)
    setBanners(prev => prev.filter(b => b.id !== id))
    toast.success('Banner deleted')
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Hero Banners</h1>
          <button onClick={() => setShowNew(!showNew)} className="btn btn-primary"><Plus size={16} /> Add Banner</button>
        </div>
        {showNew && (
          <div className="card p-5 mb-5">
            <h3 className="font-semibold mb-4">New Banner</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="flex flex-col items-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-red-300 transition-colors" style={{ borderColor: '#E5E7EB' }}>
                  <Upload size={20} className="text-gray-400 mb-2" />
                  <p className="text-xs text-gray-500">{uploading ? 'Uploading...' : form.imageUrl ? 'Image uploaded ✓' : 'Upload banner image'}</p>
                  <input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
                </label>
                {form.imageUrl && <img src={form.imageUrl} alt="" className="mt-2 h-32 w-full object-cover rounded" />}
              </div>
              {[['heading','Heading'],['subheading','Subheading'],['ctaLabel','CTA Button Label'],['ctaUrl','CTA URL']].map(([k,l]) => <div key={k}><label className="text-xs text-gray-600 mb-1 block">{l}</label><input className="input" value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} /></div>)}
            </div>
            <div className="flex gap-3 mt-4"><button onClick={save} className="btn btn-primary">Add Banner</button><button onClick={() => setShowNew(false)} className="btn btn-secondary">Cancel</button></div>
          </div>
        )}
        <div className="space-y-3">
          {banners.map(b => (
            <div key={b.id} className="card p-4 flex gap-4">
              <div className="w-32 h-20 rounded overflow-hidden flex-shrink-0 bg-gray-100"><img src={b.image_url} alt={b.heading} className="w-full h-full object-cover" /></div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{b.heading || '(No heading)'}</p>
                <p className="text-xs text-gray-500">{b.subheading} · CTA: {b.cta_label} → {b.cta_url}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(b.id, b.is_active)} className={`btn text-xs ${b.is_active ? 'btn-secondary' : 'btn-primary'}`}>{b.is_active ? 'Hide' : 'Show'}</button>
                <button onClick={() => del(b.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 size={14} className="text-red-400" /></button>
              </div>
            </div>
          ))}
          {banners.length === 0 && <div className="card p-10 text-center text-sm text-gray-400">No banners yet</div>}
        </div>
      </div>
    </AdminLayout>
  )
}
