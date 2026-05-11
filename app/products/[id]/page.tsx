'use client'
import { useEffect, useState, useRef } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Upload, X, Star } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'

export default function EditProductPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [form, setForm] = useState<any>(null)
  const [variants, setVariants] = useState<any[]>([])
  const [images, setImages] = useState<any[]>([])
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: p } = await supabase.from('products').select('*').eq('id', params.id).single()
      const { data: v } = await supabase.from('product_variants').select('*').eq('product_id', params.id)
      const { data: imgs } = await supabase.from('product_images').select('*').eq('product_id', params.id).order('order_index')
      setForm(p)
      setVariants(v || [])
      setImages(imgs || [])
      setVideoUrl(p?.video_url || '')
    }
    load()
  }, [params.id])

  // Upload video to Cloudinary
  const uploadVideo = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) { toast.error('Video must be under 50MB'); return }
    setUploadingVideo(true)
    try {
      const { data: cfg } = await supabase.from('site_config').select('value').eq('key', 'cloudinary_cloud_name').single()
      if (!cfg?.value) { toast.error('Set Cloudinary Cloud Name in Config first'); setUploadingVideo(false); return }
      const fd = new FormData()
      fd.append('file', file)
      fd.append('upload_preset', 'skss_products')
      fd.append('folder', 'skss/videos')
      fd.append('resource_type', 'video')
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.value}/video/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) {
        setVideoUrl(data.secure_url)
        toast.success('Video uploaded!')
      } else {
        toast.error('Video upload failed')
      }
    } catch { toast.error('Upload error') }
    setUploadingVideo(false)
  }

  // Upload image to Cloudinary
  const uploadImage = async (file: File) => {
    setUploading(true)
    try {
      const { data: cfg } = await supabase.from('site_config').select('value').eq('key', 'cloudinary_cloud_name').single()
      if (!cfg?.value) { toast.error('Set Cloudinary Cloud Name in Config first'); setUploading(false); return }
      const fd = new FormData()
      fd.append('file', file)
      fd.append('upload_preset', 'skss_products')
      fd.append('folder', 'skss/products')
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.value}/image/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) {
        const isPrimary = images.length === 0
        const { data: newImg } = await supabase.from('product_images').insert({
          product_id: params.id,
          url: data.secure_url,
          public_id: data.public_id,
          is_primary: isPrimary,
          order_index: images.length,
          alt_text: form?.name || '',
        }).select().single()
        if (newImg) setImages(prev => [...prev, newImg])
        toast.success('Image uploaded!')
      } else {
        toast.error('Upload failed')
      }
    } catch {
      toast.error('Upload error')
    }
    setUploading(false)
  }

  // Set an image as primary
  const setPrimary = async (imgId: string) => {
    await supabase.from('product_images').update({ is_primary: false }).eq('product_id', params.id)
    await supabase.from('product_images').update({ is_primary: true }).eq('id', imgId)
    setImages(prev => prev.map(i => ({ ...i, is_primary: i.id === imgId })))
    toast.success('Primary image updated')
  }

  // Delete an image
  const deleteImage = async (imgId: string, publicId: string) => {
    await supabase.from('product_images').delete().eq('id', imgId)
    const remaining = images.filter(i => i.id !== imgId)
    setImages(remaining)
    // If deleted image was primary, make first remaining image primary
    if (remaining.length > 0) {
      const wasPrimary = images.find(i => i.id === imgId)?.is_primary
      if (wasPrimary) {
        await supabase.from('product_images').update({ is_primary: true }).eq('id', remaining[0].id)
        setImages(prev => prev.map((i, idx) => ({ ...i, is_primary: idx === 0 })))
      }
    }
    toast.success('Image deleted')
  }

  const save = async () => {
    if (!form) return
    setSaving(true)
    await supabase.from('products').update({
      name: form.name, description: form.description, fabric: form.fabric,
      weave_type: form.weave_type, origin_region: form.origin_region,
      original_price: form.original_price, sale_price: form.sale_price || null,
      gst_rate: form.gst_rate, is_active: form.is_active, is_featured: form.is_featured,
      is_bestseller: form.is_bestseller, blouse_included: form.blouse_included,
      care_instructions: form.care_instructions,
      video_url: videoUrl || null,
      updated_at: new Date().toISOString()
    }).eq('id', params.id)

    for (const v of variants) {
      if (v.id) {
        await supabase.from('product_variants').update({ colour: v.colour, colour_hex: v.colour_hex, stock: Number(v.stock) }).eq('id', v.id)
      } else {
        await supabase.from('product_variants').insert({ product_id: params.id, colour: v.colour, colour_hex: v.colour_hex, stock: Number(v.stock) })
      }
    }
    toast.success('Product updated!')
    setSaving(false)
  }

  if (!form) return <AdminLayout><div className="text-center py-20 text-sm text-gray-400">Loading...</div></AdminLayout>

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label className="text-xs text-gray-600 mb-1 block">{label}</label>{children}</div>
  )

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
          <div className="flex gap-3">
            <button onClick={() => router.back()} className="btn btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>

        {/* Basic Info */}
        <div className="card p-5 space-y-4 mb-5">
          <h2 className="font-semibold text-gray-900">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <F label="Product Name"><input className="input" value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} /></F>
            <F label="Fabric"><input className="input" value={form.fabric || ''} onChange={e => setForm((p: any) => ({ ...p, fabric: e.target.value }))} /></F>
            <F label="Weave Type"><input className="input" value={form.weave_type || ''} onChange={e => setForm((p: any) => ({ ...p, weave_type: e.target.value }))} /></F>
            <F label="Origin / Region"><input className="input" value={form.origin_region || ''} onChange={e => setForm((p: any) => ({ ...p, origin_region: e.target.value }))} /></F>
            <F label="Original Price (₹)"><input className="input" type="number" value={form.original_price || ''} onChange={e => setForm((p: any) => ({ ...p, original_price: e.target.value }))} /></F>
            <F label="Sale Price (₹)"><input className="input" type="number" value={form.sale_price || ''} onChange={e => setForm((p: any) => ({ ...p, sale_price: e.target.value }))} /></F>
            <div className="col-span-2"><F label="Description"><textarea className="input" style={{ height: 100, resize: 'none' }} value={form.description || ''} onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))} /></F></div>
            <F label="Care Instructions"><input className="input" value={form.care_instructions || ''} onChange={e => setForm((p: any) => ({ ...p, care_instructions: e.target.value }))} /></F>
            <div className="flex flex-wrap gap-4 col-span-2 pt-2">
              {[['is_active','Published'],['is_featured','Featured'],['is_bestseller','Bestseller'],['blouse_included','Blouse Included']].map(([k,l]) => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!form[k]} onChange={e => setForm((p: any) => ({ ...p, [k]: e.target.checked }))} className="w-4 h-4" style={{ accentColor: 'var(--crimson)' }} />{l}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Issue 6 fix — Image Management */}
        <div className="card p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Product Images</h2>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="btn btn-secondary text-xs flex items-center gap-1">
              <Upload size={12} /> {uploading ? 'Uploading...' : 'Add Image'}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} />

          {images.length === 0 ? (
            <button onClick={() => fileRef.current?.click()}
              className="w-full h-28 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-red-300 transition-colors">
              <Upload size={20} className="text-gray-400" />
              <p className="text-xs text-gray-400">Click to upload product images</p>
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {images.map((img) => (
                <div key={img.id} className="relative group">
                  <div className="relative aspect-square border-2 rounded-lg overflow-hidden"
                    style={{ borderColor: img.is_primary ? 'var(--crimson)' : '#E5E7EB' }}>
                    <Image src={img.url} alt={img.alt_text || 'Product'} fill className="object-cover" />
                    {img.is_primary && (
                      <div className="absolute top-0 left-0 right-0 text-center py-0.5 text-white text-xs font-medium"
                        style={{ background: 'var(--crimson)', fontSize: 9 }}>
                        ★ Primary
                      </div>
                    )}
                    {/* Hover actions */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      {!img.is_primary && (
                        <button onClick={() => setPrimary(img.id)}
                          className="flex items-center gap-1 bg-white text-gray-800 rounded px-2 py-1 text-xs font-medium">
                          <Star size={10} /> Set Primary
                        </button>
                      )}
                      <button onClick={() => deleteImage(img.id, img.public_id)}
                        className="flex items-center gap-1 bg-red-500 text-white rounded px-2 py-1 text-xs font-medium">
                        <X size={10} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {/* Add more button */}
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="aspect-square border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-red-300 transition-colors">
                <Plus size={18} className="text-gray-400" />
                <span className="text-xs text-gray-400">Add</span>
              </button>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3">Hover over an image to set it as primary or delete it. Primary image is shown first in the storefront.</p>
        </div>

        {/* Video Upload — Optional */}
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-1">Product Video <span className="text-xs font-normal text-gray-400 ml-1">(Optional)</span></h2>
          <p className="text-xs text-gray-400 mb-4">Short saree drape video (15-60 sec). MP4 format, max 50MB. Customers can play it on the product page.</p>
          <input ref={videoRef} type="file" accept="video/mp4,video/*" className="hidden"
            onChange={e => e.target.files?.[0] && uploadVideo(e.target.files[0])} />
          {videoUrl ? (
            <div className="space-y-3">
              <video src={videoUrl} controls className="w-full rounded-lg" style={{ maxHeight: 200 }} preload="metadata" />
              <div className="flex gap-2">
                <button onClick={() => videoRef.current?.click()} disabled={uploadingVideo}
                  className="btn btn-secondary text-xs flex items-center gap-1">
                  <Upload size={12} /> {uploadingVideo ? 'Uploading...' : 'Replace Video'}
                </button>
                <button onClick={() => setVideoUrl('')}
                  className="btn text-xs flex items-center gap-1 text-red-500 hover:bg-red-50 border border-red-200">
                  <X size={12} /> Remove Video
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => videoRef.current?.click()} disabled={uploadingVideo}
              className="w-full h-24 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-red-300 transition-colors">
              {uploadingVideo ? (
                <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  <p className="text-xs text-gray-400">Click to upload product video (MP4)</p>
                </>
              )}
            </button>
          )}
        </div>

        {/* Variants */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Variants & Stock</h2>
            <button onClick={() => setVariants(prev => [...prev, { colour: '', colour_hex: '#8B1A2B', stock: 0 }])} className="btn btn-secondary text-xs"><Plus size={12} /> Add</button>
          </div>
          <div className="space-y-3">
            {variants.map((v, i) => (
              <div key={i} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Colour Name</label>
                  <input className="input" placeholder="e.g. Royal Red" value={v.colour} onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, colour: e.target.value } : x))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Swatch</label>
                  <input type="color" value={v.colour_hex} onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, colour_hex: e.target.value } : x))} className="w-10 h-10 border rounded cursor-pointer" style={{ padding: 2 }} />
                </div>
                <div className="w-28">
                  <label className="text-xs text-gray-500 mb-1 block">Stock</label>
                  <input type="number" className="input" value={v.stock} onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, stock: e.target.value } : x))} />
                </div>
                <button onClick={() => setVariants(prev => prev.filter((_, j) => j !== i))} className="p-2 text-red-400 hover:text-red-600 mb-0.5"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
