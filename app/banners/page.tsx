'use client'
import { useEffect, useState, useRef } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Upload, Edit, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'

const OVERLAY_OPTIONS = [
  { value: 'dark', label: 'Dark (default)' },
  { value: 'light', label: 'Light' },
  { value: 'none', label: 'None' },
  { value: 'left', label: 'Dark Left' },
  { value: 'right', label: 'Dark Right' },
]

const TEXT_COLOR_OPTIONS = [
  { value: 'white', label: 'White' },
  { value: 'gold', label: 'Gold' },
  { value: 'dark', label: 'Dark' },
]

const FOCUS_POINTS = [
  { value: 'top left',    label: '↖', title: 'Top Left' },
  { value: 'top center',  label: '↑', title: 'Top Center' },
  { value: 'top right',   label: '↗', title: 'Top Right' },
  { value: 'center left', label: '←', title: 'Center Left' },
  { value: 'center',      label: '●', title: 'Center' },
  { value: 'center right',label: '→', title: 'Center Right' },
  { value: 'bottom left', label: '↙', title: 'Bottom Left' },
  { value: 'bottom center',label:'↓', title: 'Bottom Center' },
  { value: 'bottom right',label: '↘', title: 'Bottom Right' },
]

const DEFAULT_FORM = {
  imageUrl: '',
  imageFocus: 'center',
  videoUrl: '',
  heading: '',
  headingItalic: '',
  subheading: '',
  badgeText: '',
  ctaLabel: 'Shop Now',
  ctaUrl: '/shop',
  ctaSecondaryLabel: '',
  ctaSecondaryUrl: '',
  overlayStyle: 'dark',
  textColor: 'white',
  isActive: true,
  displayOrder: 0,
}

// Moved outside component to prevent focus loss on re-render
const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs text-gray-600 mb-1 block font-medium">{label}</label>
    {children}
  </div>
)

export default function BannersPage() {
  const [banners, setBanners] = useState<any[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>({ ...DEFAULT_FORM })
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('banners').select('*').order('display_order')
      .then(({ data }) => setBanners(data || []))
  }, [])

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const { data: cfg } = await supabase.from('site_config').select('value').eq('key', 'cloudinary_cloud_name').single()
      if (!cfg?.value) { toast.error('Set Cloudinary Cloud Name in Config first'); setUploading(false); return }
      const fd = new FormData()
      fd.append('file', file)
      fd.append('upload_preset', 'skss_banners')
      fd.append('folder', 'skss/banners')
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.value}/image/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) {
        setForm((p: any) => ({ ...p, imageUrl: data.secure_url }))
        toast.success('Image uploaded!')
      } else {
        toast.error('Upload failed')
      }
    } catch {
      toast.error('Upload error')
    }
    setUploading(false)
  }

  const save = async () => {
    if (!form.imageUrl) { toast.error('Please upload a banner image'); return }
    const payload = {
      image_url: form.imageUrl,
      image_focus: form.imageFocus,
      video_url: form.videoUrl || null,
      heading: form.heading,
      heading_italic: form.headingItalic,
      subheading: form.subheading || null,
      badge_text: form.badgeText || null,
      cta_label: form.ctaLabel,
      cta_url: form.ctaUrl,
      cta_secondary_label: form.ctaSecondaryLabel || null,
      cta_secondary_url: form.ctaSecondaryUrl || null,
      overlay_style: form.overlayStyle,
      text_color: form.textColor,
      is_active: form.isActive,
    }
    if (editId) {
      const { data } = await supabase.from('banners').update(payload).eq('id', editId).select().single()
      setBanners(prev => prev.map(b => b.id === editId ? data : b))
      toast.success('Banner updated!')
    } else {
      const { data } = await supabase.from('banners').insert({ ...payload, display_order: banners.length + 1 }).select().single()
      setBanners(prev => [...prev, data])
      toast.success('Banner added!')
    }
    resetForm()
  }

  const resetForm = () => {
    setShowForm(false); setEditId(null); setForm({ ...DEFAULT_FORM })
  }

  const startEdit = (b: any) => {
    setForm({
      imageUrl: b.image_url || '',
      imageFocus: b.image_focus || 'center',
      videoUrl: b.video_url || '',
      heading: b.heading || '',
      headingItalic: b.heading_italic || '',
      subheading: b.subheading || '',
      badgeText: b.badge_text || '',
      ctaLabel: b.cta_label || 'Shop Now',
      ctaUrl: b.cta_url || '/shop',
      ctaSecondaryLabel: b.cta_secondary_label || '',
      ctaSecondaryUrl: b.cta_secondary_url || '',
      overlayStyle: b.overlay_style || 'dark',
      textColor: b.text_color || 'white',
      isActive: b.is_active,
    })
    setEditId(b.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

  const moveOrder = async (id: string, dir: 'up' | 'down') => {
    const idx = banners.findIndex(b => b.id === id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= banners.length) return
    const a = banners[idx], b2 = banners[swapIdx]
    await supabase.from('banners').update({ display_order: b2.display_order }).eq('id', a.id)
    await supabase.from('banners').update({ display_order: a.display_order }).eq('id', b2.id)
    const updated = [...banners]
    updated[idx] = { ...a, display_order: b2.display_order }
    updated[swapIdx] = { ...b2, display_order: a.display_order }
    setBanners(updated.sort((x, y) => x.display_order - y.display_order))
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Hero Banners</h1>
            <p className="text-sm text-gray-500 mt-0.5">Customise the homepage hero section</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="btn btn-primary">
            <Plus size={16} /> Add Banner
          </button>
        </div>

        {showForm && (
          <div className="card p-6 mb-6 border-2" style={{ borderColor: 'var(--crimson)', borderStyle: 'solid' }}>
            <h3 className="font-semibold text-gray-900 mb-5 text-lg">{editId ? 'Edit Banner' : 'New Banner'}</h3>

            {/* ── IMAGE UPLOAD ── */}
            <div className="mb-5">
              <label className="text-xs text-gray-600 mb-2 block font-medium">Banner Image *</label>
              <input ref={fileRef} type="file" className="hidden" accept="image/*"
                onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />

              {form.imageUrl ? (
                <div className="space-y-3">
                  {/* Image preview with focus point overlay */}
                  <div className="relative w-full rounded-lg overflow-hidden border border-gray-200" style={{ height: 200 }}>
                    <img src={form.imageUrl} alt="Banner preview"
                      className="w-full h-full"
                      style={{ objectFit: 'cover', objectPosition: form.imageFocus }} />
                    <div className="absolute inset-0 bg-black/20 flex items-end p-3">
                      <span className="text-white text-xs bg-black/50 px-2 py-1 rounded">
                        Preview — Focus: {form.imageFocus}
                      </span>
                    </div>
                  </div>

                  {/* Focus point selector */}
                  <div>
                    <label className="text-xs text-gray-600 mb-2 block font-medium">
                      Image Focus Point — choose which part of the image to show
                    </label>
                    <div className="grid grid-cols-3 gap-1 w-32">
                      {FOCUS_POINTS.map(fp => (
                        <button key={fp.value} title={fp.title}
                          onClick={() => setForm((p: any) => ({ ...p, imageFocus: fp.value }))}
                          className="h-9 w-9 text-sm font-bold rounded border transition-all flex items-center justify-center"
                          style={{
                            background: form.imageFocus === fp.value ? 'var(--crimson)' : 'white',
                            color: form.imageFocus === fp.value ? 'white' : '#6B7280',
                            borderColor: form.imageFocus === fp.value ? 'var(--crimson)' : '#E5E7EB',
                          }}>
                          {fp.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Click a position to set where the image is anchored</p>
                  </div>

                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="btn btn-secondary text-xs flex items-center gap-1">
                    <Upload size={12} /> {uploading ? 'Uploading...' : 'Change Image'}
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="w-full h-32 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-red-300 transition-colors">
                  {uploading ? (
                    <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload size={20} className="text-gray-400" />
                      <p className="text-xs text-gray-400">Click to upload banner image</p>
                      <p className="text-xs text-gray-300">Recommended: 1920×1080px or wider</p>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* ── TEXT CONTENT ── */}
            <div className="border-t border-gray-100 pt-5 mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-1">Background Video (Optional)</p>
              <p className="text-xs text-gray-400 mb-3">If set, video plays instead of image. Upload MP4 to Cloudinary and paste the URL. Keep under 10MB for fast loading.</p>
              <input
                className="input"
                value={form.videoUrl}
                onChange={e => setForm((p: any) => ({ ...p, videoUrl: e.target.value }))}
                placeholder="https://res.cloudinary.com/.../video.mp4 (optional)"
              />
              {form.videoUrl && (
                <p className="text-xs text-green-600 mt-1">✓ Video URL set — will play as background on homepage hero</p>
              )}
            </div>
            <div className="border-t border-gray-100 pt-5 mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-4">Text Content</p>
              <div className="grid grid-cols-2 gap-4">
                <F label="Badge Text (small label above heading)">
                  <input className="input" value={form.badgeText}
                    onChange={e => setForm((p: any) => ({ ...p, badgeText: e.target.value }))}
                    placeholder="e.g. New Collection 2025" />
                </F>
                <div />
                <F label="Heading (main title)">
                  <input className="input" value={form.heading}
                    onChange={e => setForm((p: any) => ({ ...p, heading: e.target.value }))}
                    placeholder="e.g. Draped in" />
                </F>
                <F label="Heading Italic Part (shown in gold italic)">
                  <input className="input" value={form.headingItalic}
                    onChange={e => setForm((p: any) => ({ ...p, headingItalic: e.target.value }))}
                    placeholder="e.g. Royal Elegance" />
                </F>
                <div className="col-span-2">
                  <F label="Subheading (description paragraph)">
                    <textarea className="input" rows={2} value={form.subheading}
                      onChange={e => setForm((p: any) => ({ ...p, subheading: e.target.value }))}
                      placeholder="e.g. Discover timeless silk sarees crafted for the modern woman." />
                  </F>
                </div>
              </div>
            </div>

            {/* ── CTA BUTTONS ── */}
            <div className="border-t border-gray-100 pt-5 mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-4">Call to Action Buttons</p>
              <div className="grid grid-cols-2 gap-4">
                <F label="Primary Button Label">
                  <input className="input" value={form.ctaLabel}
                    onChange={e => setForm((p: any) => ({ ...p, ctaLabel: e.target.value }))}
                    placeholder="Shop Now" />
                </F>
                <F label="Primary Button URL">
                  <input className="input" value={form.ctaUrl}
                    onChange={e => setForm((p: any) => ({ ...p, ctaUrl: e.target.value }))}
                    placeholder="/shop" />
                </F>
                <F label="Secondary Button Label (optional)">
                  <input className="input" value={form.ctaSecondaryLabel}
                    onChange={e => setForm((p: any) => ({ ...p, ctaSecondaryLabel: e.target.value }))}
                    placeholder="e.g. New Arrivals" />
                </F>
                <F label="Secondary Button URL">
                  <input className="input" value={form.ctaSecondaryUrl}
                    onChange={e => setForm((p: any) => ({ ...p, ctaSecondaryUrl: e.target.value }))}
                    placeholder="/shop?filter=new" />
                </F>
              </div>
            </div>

            {/* ── STYLING ── */}
            <div className="border-t border-gray-100 pt-5 mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-4">Style & Overlay</p>
              <div className="grid grid-cols-2 gap-4">
                <F label="Overlay Style">
                  <select className="input" value={form.overlayStyle}
                    onChange={e => setForm((p: any) => ({ ...p, overlayStyle: e.target.value }))}>
                    {OVERLAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </F>
                <F label="Text Color">
                  <select className="input" value={form.textColor}
                    onChange={e => setForm((p: any) => ({ ...p, textColor: e.target.value }))}>
                    {TEXT_COLOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </F>
              </div>
            </div>

            {/* ── VISIBILITY ── */}
            <div className="border-t border-gray-100 pt-4 mb-5">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.isActive}
                  onChange={e => setForm((p: any) => ({ ...p, isActive: e.target.checked }))}
                  className="w-4 h-4" style={{ accentColor: 'var(--crimson)' }} />
                Active (visible on storefront)
              </label>
            </div>

            <div className="flex gap-3">
              <button onClick={save} className="btn btn-primary">{editId ? 'Update Banner' : 'Add Banner'}</button>
              <button onClick={resetForm} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        {/* ── BANNER LIST ── */}
        <div className="space-y-3">
          {banners.map((b, idx) => (
            <div key={b.id} className="card p-4 flex gap-4 items-center">
              {/* Reorder */}
              <div className="flex flex-col gap-1">
                <button onClick={() => moveOrder(b.id, 'up')} disabled={idx === 0}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronUp size={14} /></button>
                <button onClick={() => moveOrder(b.id, 'down')} disabled={idx === banners.length - 1}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronDown size={14} /></button>
              </div>

              {/* Thumbnail */}
              <div className="w-36 h-20 rounded overflow-hidden flex-shrink-0 bg-gray-100 relative border border-gray-200">
                {b.image_url && (
                  <img src={b.image_url} alt={b.heading}
                    className="w-full h-full"
                    style={{ objectFit: 'cover', objectPosition: b.image_focus || 'center' }} />
                )}
                <div className="absolute bottom-1 right-1">
                  <span className="text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                    {b.image_focus || 'center'}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-gray-900 truncate">
                    {b.heading || '(No heading)'}{b.heading_italic ? ` + "${b.heading_italic}"` : ''}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {b.is_active ? 'Active' : 'Hidden'}
                  </span>
                </div>
                {b.subheading && <p className="text-xs text-gray-400 truncate mb-1">{b.subheading}</p>}
                <div className="flex gap-3 text-xs text-gray-400">
                  <span>CTA: <strong>{b.cta_label}</strong> → {b.cta_url}</span>
                  {b.cta_secondary_label && <span>2nd: <strong>{b.cta_secondary_label}</strong></span>}
                  <span>Overlay: {b.overlay_style || 'dark'}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => startEdit(b)}
                  className="p-1.5 hover:bg-gray-100 rounded" title="Edit">
                  <Edit size={14} style={{ color: 'var(--crimson)' }} />
                </button>
                <button onClick={() => toggleActive(b.id, b.is_active)}
                  className="p-1.5 hover:bg-gray-100 rounded" title={b.is_active ? 'Hide' : 'Show'}>
                  {b.is_active ? <EyeOff size={14} className="text-gray-400" /> : <Eye size={14} className="text-green-500" />}
                </button>
                <button onClick={() => del(b.id)}
                  className="p-1.5 hover:bg-red-50 rounded" title="Delete">
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>
            </div>
          ))}
          {banners.length === 0 && (
            <div className="card p-12 text-center text-sm text-gray-400">
              No banners yet — click Add Banner to create your first hero banner
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
