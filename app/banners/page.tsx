'use client'
import { useEffect, useState, useRef } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Upload, Edit, Eye, EyeOff, ChevronUp, ChevronDown, Video, X, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'

const OVERLAY_OPTIONS = [
  { value: 'dark',  label: 'Dark (default)' },
  { value: 'light', label: 'Light' },
  { value: 'none',  label: 'None' },
  { value: 'left',  label: 'Dark Left' },
  { value: 'right', label: 'Dark Right' },
]
const TEXT_COLOR_OPTIONS = [
  { value: 'white', label: 'White' },
  { value: 'gold',  label: 'Gold' },
  { value: 'dark',  label: 'Dark' },
]

const DEFAULT_FORM = {
  imageUrl: '', imageFocus: 'center',
  videoUrls: [''],   // array of video URLs — multiple videos supported
  heading: '', headingItalic: '', subheading: '', badgeText: '',
  ctaLabel: 'Shop Now', ctaUrl: '/shop',
  ctaSecondaryLabel: '', ctaSecondaryUrl: '',
  overlayStyle: 'dark', textColor: 'white', isActive: true,
}

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
  const [uploadingVideoIdx, setUploadingVideoIdx] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const videoFileRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    supabase.from('banners').select('*').order('display_order')
      .then(({ data }) => setBanners(data || []))
  }, [])

  const getCloudName = async () => {
    const { data: cfg } = await supabase.from('site_config').select('value').eq('key', 'cloudinary_cloud_name').single()
    if (!cfg?.value) { toast.error('Set Cloudinary Cloud Name in Config first'); return null }
    return cfg.value
  }

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const cloudName = await getCloudName(); if (!cloudName) { setUploading(false); return }
      const fd = new FormData()
      fd.append('file', file); fd.append('upload_preset', 'skss_banners'); fd.append('folder', 'skss/banners')
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) { setForm((p: any) => ({ ...p, imageUrl: data.secure_url })); toast.success('Image uploaded!') }
      else toast.error('Upload failed')
    } catch { toast.error('Upload error') }
    setUploading(false)
  }

  const uploadVideo = async (file: File, idx: number) => {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime']
    if (!allowed.includes(file.type)) { toast.error('Only MP4, WebM or MOV supported'); return }
    if (file.size > 50 * 1024 * 1024) { toast.error('Video must be under 50MB'); return }
    setUploadingVideoIdx(idx)
    try {
      const cloudName = await getCloudName(); if (!cloudName) { setUploadingVideoIdx(null); return }
      const fd = new FormData()
      fd.append('file', file); fd.append('upload_preset', 'skss_banners'); fd.append('folder', 'skss/banners')
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) {
        setForm((p: any) => {
          const urls = [...(p.videoUrls || [''])]
          urls[idx] = data.secure_url
          return { ...p, videoUrls: urls }
        })
        toast.success(`Video ${idx + 1} uploaded! (${(file.size / 1024 / 1024).toFixed(1)}MB)`)
      } else { toast.error(data.error?.message || 'Upload failed') }
    } catch { toast.error('Video upload error') }
    setUploadingVideoIdx(null)
  }

  const addVideoSlot = () => setForm((p: any) => ({ ...p, videoUrls: [...(p.videoUrls || ['']), ''] }))
  const removeVideoSlot = (idx: number) => setForm((p: any) => ({
    ...p, videoUrls: (p.videoUrls || ['']).filter((_: any, i: number) => i !== idx) || ['']
  }))
  const setVideoUrl = (idx: number, val: string) => setForm((p: any) => {
    const urls = [...(p.videoUrls || [''])]
    urls[idx] = val
    return { ...p, videoUrls: urls }
  })

  const save = async () => {
    if (!form.imageUrl) { toast.error('Please upload a banner image (required as fallback for video)'); return }
    const validVideos = (form.videoUrls || []).filter((v: string) => v.trim())
    const payload = {
      image_url: form.imageUrl, image_focus: form.imageFocus,
      // Store first video in legacy video_url for backwards compat
      video_url: validVideos[0] || null,
      // Store all videos as JSON array in video_urls
      video_urls: validVideos.length > 0 ? JSON.stringify(validVideos) : null,
      heading: form.heading, heading_italic: form.headingItalic, subheading: form.subheading || null,
      badge_text: form.badgeText || null, cta_label: form.ctaLabel, cta_url: form.ctaUrl,
      cta_secondary_label: form.ctaSecondaryLabel || null, cta_secondary_url: form.ctaSecondaryUrl || null,
      overlay_style: form.overlayStyle, text_color: form.textColor, is_active: form.isActive,
    }
    if (editId) {
      const { data, error } = await supabase.from('banners').update(payload).eq('id', editId).select().single()
      if (error) { toast.error('Failed to update: ' + error.message); return }
      setBanners(prev => prev.map(b => b.id === editId ? data : b))
      toast.success('Banner updated!')
    } else {
      const { data, error } = await supabase.from('banners').insert({ ...payload, display_order: banners.length + 1 }).select().single()
      if (error) { toast.error('Failed to add: ' + error.message); return }
      setBanners(prev => [...prev, data])
      toast.success('Banner added!')
    }
    resetForm()
  }

  const resetForm = () => { setShowForm(false); setEditId(null); setForm({ ...DEFAULT_FORM }) }

  const startEdit = (b: any) => {
    // Parse video_urls JSON array, fall back to legacy video_url
    let videoUrls: string[] = ['']
    try {
      if (b.video_urls) videoUrls = JSON.parse(b.video_urls)
      else if (b.video_url) videoUrls = [b.video_url]
    } catch { if (b.video_url) videoUrls = [b.video_url] }
    if (!videoUrls.length) videoUrls = ['']

    setForm({
      imageUrl: b.image_url || '', imageFocus: b.image_focus || 'center',
      videoUrls,
      heading: b.heading || '', headingItalic: b.heading_italic || '', subheading: b.subheading || '',
      badgeText: b.badge_text || '', ctaLabel: b.cta_label || 'Shop Now', ctaUrl: b.cta_url || '/shop',
      ctaSecondaryLabel: b.cta_secondary_label || '', ctaSecondaryUrl: b.cta_secondary_url || '',
      overlayStyle: b.overlay_style || 'dark', textColor: b.text_color || 'white', isActive: b.is_active,
    })
    setEditId(b.id); setShowForm(true)
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
    const [r1, r2] = await Promise.all([
      supabase.from('banners').update({ display_order: b2.display_order }).eq('id', a.id),
      supabase.from('banners').update({ display_order: a.display_order }).eq('id', b2.id),
    ])
    if (r1.error || r2.error) { toast.error('Failed to reorder'); return }
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
          <button type="button" onClick={() => { resetForm(); setShowForm(true) }} className="btn btn-primary">
            <Plus size={16} /> Add Banner
          </button>
        </div>

        {showForm && (
          <div className="card p-6 mb-6 border-2" style={{ borderColor: 'var(--crimson)', borderStyle: 'solid' }}>
            <h3 className="font-semibold text-gray-900 mb-5 text-lg">{editId ? 'Edit Banner' : 'New Banner'}</h3>

            {/* IMAGE */}
            <div className="mb-5">
              <label className="text-xs text-gray-600 mb-2 block font-medium">Banner Image *</label>
              <input ref={fileRef} type="file" className="hidden" accept="image/*"
                onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
              {form.imageUrl ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-600 mb-1.5 block font-medium">Click anywhere to set focus point</label>
                    <div className="relative w-full rounded-lg overflow-hidden border-2 border-gray-200 select-none"
                      style={{ height: 260, cursor: 'crosshair' }}
                      onClick={e => {
                        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                        const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
                        const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
                        setForm((p: any) => ({ ...p, imageFocus: `${x}% ${y}%` }))
                      }}>
                      <img src={form.imageUrl} alt="Banner" className="w-full h-full"
                        style={{ objectFit: 'cover', objectPosition: form.imageFocus, pointerEvents: 'none' }} draggable={false} />
                      {(() => {
                        const parts = (form.imageFocus || 'center').split(' ')
                        const px = parts.length === 2 ? parseFloat(parts[0]) : 50
                        const py = parts.length === 2 ? parseFloat(parts[1]) : 50
                        return (
                          <div className="absolute pointer-events-none" style={{ left: `${px}%`, top: `${py}%`, transform: 'translate(-50%,-50%)' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid white', boxShadow: '0 0 0 1.5px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.15)' }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--crimson)', boxShadow: '0 0 0 2px white' }} />
                            </div>
                          </div>
                        )
                      })()}
                      <div className="absolute bottom-2 right-2 pointer-events-none">
                        <span className="text-white text-xs bg-black/60 px-2 py-1 rounded font-mono">{form.imageFocus || 'center'}</span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1 font-medium">📱 Mobile preview</p>
                        <div className="relative rounded overflow-hidden border" style={{ height: 100, background: '#F3F4F6' }}>
                          <img src={form.imageUrl} alt="" className="w-full h-full" style={{ objectFit: 'cover', objectPosition: form.imageFocus }} />
                          <div className="absolute inset-0 border-2 border-dashed border-blue-400 pointer-events-none opacity-60 rounded" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1 font-medium">🖥️ Desktop preview</p>
                        <div className="relative rounded overflow-hidden border" style={{ height: 100, background: '#F3F4F6' }}>
                          <img src={form.imageUrl} alt="" className="w-full h-full" style={{ objectFit: 'cover', objectPosition: form.imageFocus }} />
                          <div className="absolute inset-0 border-2 border-dashed border-green-400 pointer-events-none opacity-60 rounded" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="btn btn-secondary text-xs flex items-center gap-1">
                    <Upload size={12} /> {uploading ? 'Uploading...' : 'Change Image'}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="w-full h-32 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-red-300 transition-colors">
                  {uploading ? <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    : <><Upload size={20} className="text-gray-400" /><p className="text-xs text-gray-400">Click to upload banner image</p><p className="text-xs text-gray-300">Recommended: 1920×1080px or wider</p></>}
                </button>
              )}
            </div>

            {/* VIDEOS — multiple supported */}
            <div className="border-t border-gray-100 pt-5 mb-5">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Background Videos</p>
                  <p className="text-xs text-gray-400 mt-0.5">Add multiple videos — they will play in sequence on the banner. Keep each under 20MB for fast loading.</p>
                </div>
                <button type="button" onClick={addVideoSlot}
                  className="btn btn-secondary text-xs flex items-center gap-1" style={{ flexShrink: 0 }}>
                  <Plus size={12} /> Add Video
                </button>
              </div>
              <p className="text-xs text-amber-600 mt-2 mb-4 flex items-start gap-1.5">
                <span className="flex-shrink-0">⚠️</span>
                Make sure your <strong>skss_banners</strong> Cloudinary preset allows video formats. The banner image is used as poster/fallback.
              </p>

              <div className="space-y-4">
                {(form.videoUrls || ['']).map((videoUrl: string, idx: number) => (
                  <div key={idx} className="border rounded-lg p-4" style={{ borderColor: '#E5E7EB' }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                        <Video size={12} /> Video {idx + 1}
                        {idx === 0 && <span className="text-gray-400 font-normal">(plays first)</span>}
                      </p>
                      {(form.videoUrls || []).length > 1 && (
                        <button type="button" onClick={() => removeVideoSlot(idx)}
                          className="p-1 text-red-400 hover:text-red-600"><X size={14} /></button>
                      )}
                    </div>

                    {/* Hidden input */}
                    <input
                      ref={el => { videoFileRefs.current[idx] = el }}
                      type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && uploadVideo(e.target.files[0], idx)}
                    />

                    {videoUrl ? (
                      <div className="space-y-2">
                        <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-black" style={{ height: 120 }}>
                          <video key={videoUrl} src={videoUrl} className="w-full h-full object-cover" muted loop playsInline autoPlay />
                          <div className="absolute top-2 left-2">
                            <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded flex items-center gap-1">
                              <Video size={10} /> Video {idx + 1} set
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button type="button" onClick={() => videoFileRefs.current[idx]?.click()}
                            disabled={uploadingVideoIdx === idx}
                            className="btn btn-secondary text-xs flex items-center gap-1">
                            <Upload size={11} /> {uploadingVideoIdx === idx ? 'Uploading...' : 'Replace'}
                          </button>
                          <button type="button" onClick={() => setVideoUrl(idx, '')}
                            className="btn text-xs flex items-center gap-1 text-red-500 border border-red-200 hover:bg-red-50">
                            <X size={11} /> Remove
                          </button>
                        </div>
                        <input className="input text-xs font-mono" value={videoUrl}
                          onChange={e => setVideoUrl(idx, e.target.value)}
                          placeholder="https://res.cloudinary.com/.../video.mp4" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button type="button" onClick={() => videoFileRefs.current[idx]?.click()}
                          disabled={uploadingVideoIdx === idx}
                          className="w-full h-20 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-1.5 hover:border-red-300 transition-colors">
                          {uploadingVideoIdx === idx
                            ? <><div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /><p className="text-xs text-gray-500">Uploading...</p></>
                            : <><Video size={18} className="text-gray-400" /><p className="text-xs text-gray-500">Click to upload video {idx + 1}</p><p className="text-xs text-gray-400">MP4, WebM or MOV · Max 20MB</p></>
                          }
                        </button>
                        <input className="input text-xs" value={videoUrl}
                          onChange={e => setVideoUrl(idx, e.target.value)}
                          placeholder="Or paste a Cloudinary video URL..." />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* TEXT */}
            <div className="border-t border-gray-100 pt-5 mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-4">Text Content</p>
              <div className="grid grid-cols-2 gap-4">
                <F label="Badge Text"><input className="input" value={form.badgeText} onChange={e => setForm((p: any) => ({ ...p, badgeText: e.target.value }))} placeholder="e.g. New Collection 2025" /></F>
                <div />
                <F label="Heading"><input className="input" value={form.heading} onChange={e => setForm((p: any) => ({ ...p, heading: e.target.value }))} placeholder="e.g. Draped in" /></F>
                <F label="Heading Italic (gold)"><input className="input" value={form.headingItalic} onChange={e => setForm((p: any) => ({ ...p, headingItalic: e.target.value }))} placeholder="e.g. Royal Elegance" /></F>
                <div className="col-span-2"><F label="Subheading"><textarea className="input" rows={2} value={form.subheading} onChange={e => setForm((p: any) => ({ ...p, subheading: e.target.value }))} placeholder="e.g. Discover timeless silk sarees..." /></F></div>
              </div>
            </div>

            {/* CTA */}
            <div className="border-t border-gray-100 pt-5 mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-4">Call to Action Buttons</p>
              <div className="grid grid-cols-2 gap-4">
                <F label="Primary Button Label"><input className="input" value={form.ctaLabel} onChange={e => setForm((p: any) => ({ ...p, ctaLabel: e.target.value }))} placeholder="Shop Now" /></F>
                <F label="Primary Button URL"><input className="input" value={form.ctaUrl} onChange={e => setForm((p: any) => ({ ...p, ctaUrl: e.target.value }))} placeholder="/shop" /></F>
                <F label="Secondary Button Label"><input className="input" value={form.ctaSecondaryLabel} onChange={e => setForm((p: any) => ({ ...p, ctaSecondaryLabel: e.target.value }))} placeholder="e.g. New Arrivals" /></F>
                <F label="Secondary Button URL"><input className="input" value={form.ctaSecondaryUrl} onChange={e => setForm((p: any) => ({ ...p, ctaSecondaryUrl: e.target.value }))} placeholder="/shop?filter=new" /></F>
              </div>
            </div>

            {/* STYLE */}
            <div className="border-t border-gray-100 pt-5 mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-4">Style & Overlay</p>
              <div className="grid grid-cols-2 gap-4">
                <F label="Overlay Style">
                  <select className="input" value={form.overlayStyle} onChange={e => setForm((p: any) => ({ ...p, overlayStyle: e.target.value }))}>
                    {OVERLAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </F>
                <F label="Text Color">
                  <select className="input" value={form.textColor} onChange={e => setForm((p: any) => ({ ...p, textColor: e.target.value }))}>
                    {TEXT_COLOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </F>
              </div>
            </div>

            {/* VISIBILITY */}
            <div className="border-t border-gray-100 pt-4 mb-5">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm((p: any) => ({ ...p, isActive: e.target.checked }))}
                  className="w-4 h-4" style={{ accentColor: 'var(--crimson)' }} />
                Active (visible on storefront)
              </label>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={save} className="btn btn-primary">{editId ? 'Update Banner' : 'Add Banner'}</button>
              <button type="button" onClick={resetForm} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        {/* BANNER LIST */}
        <div className="space-y-3">
          {banners.map((b, idx) => {
            let videoCount = 0
            try { videoCount = b.video_urls ? JSON.parse(b.video_urls).filter(Boolean).length : (b.video_url ? 1 : 0) } catch {}
            return (
              <div key={b.id} className="card p-4 flex gap-4 items-center">
                <div className="flex flex-col gap-1">
                  <button type="button" onClick={() => moveOrder(b.id, 'up')} disabled={idx === 0}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronUp size={14} /></button>
                  <button type="button" onClick={() => moveOrder(b.id, 'down')} disabled={idx === banners.length - 1}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronDown size={14} /></button>
                </div>
                <div className="w-36 h-20 rounded overflow-hidden flex-shrink-0 bg-gray-100 relative border border-gray-200">
                  {b.image_url && <img src={b.image_url} alt={b.heading || 'Banner'} className="w-full h-full" style={{ objectFit: 'cover', objectPosition: b.image_focus || 'center' }} />}
                  {videoCount > 0 && (
                    <div className="absolute top-1 right-1">
                      <span className="text-xs bg-black/70 text-white px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Video size={9} /> {videoCount}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-900 truncate">{b.heading || '(No heading)'}{b.heading_italic ? ` + "${b.heading_italic}"` : ''}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {b.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </div>
                  {b.subheading && <p className="text-xs text-gray-400 truncate mb-1">{b.subheading}</p>}
                  <div className="flex gap-3 text-xs text-gray-400 flex-wrap">
                    <span>CTA: <strong>{b.cta_label}</strong> → {b.cta_url}</span>
                    {videoCount > 0 && <span className="flex items-center gap-1"><Video size={10} /> {videoCount} video{videoCount > 1 ? 's' : ''}</span>}
                    <span>Overlay: {b.overlay_style || 'dark'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button type="button" onClick={() => startEdit(b)} className="p-1.5 hover:bg-gray-100 rounded" title="Edit"><Edit size={14} style={{ color: 'var(--crimson)' }} /></button>
                  <button type="button" onClick={() => toggleActive(b.id, b.is_active)} className="p-1.5 hover:bg-gray-100 rounded" title={b.is_active ? 'Hide' : 'Show'}>
                    {b.is_active ? <EyeOff size={14} className="text-gray-400" /> : <Eye size={14} className="text-green-500" />}
                  </button>
                  <button type="button" onClick={() => del(b.id)} className="p-1.5 hover:bg-red-50 rounded" title="Delete"><Trash2 size={14} className="text-red-400" /></button>
                </div>
              </div>
            )
          })}
          {banners.length === 0 && (
            <div className="card p-12 text-center text-sm text-gray-400">No banners yet — click Add Banner to create your first hero banner</div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
