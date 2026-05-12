'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'

const OCCASIONS = ['Wedding','Festive','Casual','Office','Party','Religious','Daily Wear']
const F = ({ label, children, col2 }: { label: string; children: React.ReactNode; col2?: boolean }) => (
    <div className={col2 ? 'col-span-2' : ''}><label className="text-xs text-gray-600 font-medium mb-1 block">{label}</label>{children}</div>
  )
export default function NewProductPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<{ file?: File; url: string; publicId: string; isPrimary: boolean }[]>([])
  const [uploading, setUploading] = useState(false)
  const [variants, setVariants] = useState([{ colour: '', colourHex: '#8B1A2B', stock: 0, sku: '' }])
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([])
  const [fabrics, setFabrics] = useState<string[]>(['Silk','Cotton','Georgette','Chiffon','Linen','Organza','Net','Crepe','Tussar','Chanderi','Satin','Velvet','Khadi','Viscose'])
  const [weaveTypes, setWeaveTypes] = useState<string[]>(['Kanjivaram','Banarasi','Chanderi','Tant','Patola','Sambalpuri','Ikkat','Jamdani','Phulkari','Gadwal','Paithani','Maheshwari','Bhagalpuri','Pochampally','Kasavu','Narayanpet','Handloom','Powerloom'])
  const [form, setForm] = useState({ name: '', slug: '', description: '', fabric: '', weaveType: '', originRegion: '', careInstructions: 'Dry clean only', blouseIncluded: false, length: '5.5', weightGrams: '', categoryId: '', originalPrice: '', salePrice: '', discountPercent: '', gstRate: '5', isFeatured: false, isBestseller: false, isActive: true })

  useEffect(() => {
    supabase.from('categories').select('id,name').eq('is_active', true).then(({ data }) => setCategories(data || []))
    // Load fabrics from site_config so admin-managed list is always up to date
    supabase.from('site_config').select('value').eq('key', 'fabric_types').single().then(({ data }) => {
      if (data?.value) {
        try { setFabrics(JSON.parse(data.value)) } catch {}
      }
    })
    // Load existing weave types from products for autocomplete
    supabase.from('products').select('weave_type').not('weave_type', 'is', null).then(({ data }) => {
      if (data) {
        const unique = [...new Set([...weaveTypes, ...data.map((r: any) => r.weave_type).filter(Boolean)])]
        setWeaveTypes(unique as string[])
      }
    })
  }, [])

  const genSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).substr(2, 4)

  const uploadImage = async (file: File) => {
    setUploading(true)
    const { data: cfg } = await supabase.from('site_config').select('key,value').in('key', ['cloudinary_cloud_name', 'cloudinary_api_key'])
    const config: Record<string, string> = {}
    cfg?.forEach((c: any) => { config[c.key] = c.value })
    if (!config.cloudinary_cloud_name) {
      // Store as object URL for now
      const url = URL.createObjectURL(file)
      setImages(prev => [...prev, { file, url, publicId: '', isPrimary: prev.length === 0 }])
      setUploading(false); return
    }
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', 'skss_products')
    const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudinary_cloud_name}/image/upload`, { method: 'POST', body: formData })
    const data = await res.json()
    setImages(prev => [...prev, { url: data.secure_url, publicId: data.public_id, isPrimary: prev.length === 0 }])
    setUploading(false)
  }

  const handleSubmit = async () => {
    if (!form.name || !form.originalPrice || !form.categoryId) { toast.error('Please fill Name, Category and Price'); return }
    setLoading(true)
    const slug = form.slug || genSlug(form.name)
    try {
      const { data: product, error } = await supabase.from('products').insert({
        name: form.name, slug, description: form.description, fabric: form.fabric, weave_type: form.weaveType, origin_region: form.originRegion, occasion: selectedOccasions, care_instructions: form.careInstructions, blouse_included: form.blouseIncluded, length: Number(form.length) || 5.5, weight_grams: Number(form.weightGrams) || 0, category_id: form.categoryId, original_price: Number(form.originalPrice), sale_price: form.salePrice ? Number(form.salePrice) : null, discount_percent: form.discountPercent ? Number(form.discountPercent) : null, gst_rate: Number(form.gstRate), is_featured: form.isFeatured, is_bestseller: form.isBestseller, is_active: form.isActive
      }).select().single()
      if (error) throw error
      if (images.length > 0) await supabase.from('product_images').insert(images.map((img, i) => ({ product_id: product.id, url: img.url, public_id: img.publicId, is_primary: img.isPrimary, order_index: i })))
      if (variants.length > 0 && variants[0].colour) await supabase.from('product_variants').insert(variants.filter(v => v.colour).map(v => ({ product_id: product.id, colour: v.colour, colour_hex: v.colourHex, stock: Number(v.stock), sku: v.sku })))
      toast.success('Product created!')
      router.push('/products')
    } catch (e: any) { toast.error(e.message || 'Error creating product') }
    setLoading(false)
  }



  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">New Product</h1>
          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="btn btn-secondary">Cancel</button>
            <button type="button" onClick={handleSubmit} disabled={loading} className="btn btn-primary">{loading ? 'Saving...' : 'Save Product'}</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <F label="Product Name *" col2><input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value, slug: '' }))} /></F>
                <F label="Fabric Type">
                  <select className="input" value={form.fabric} onChange={e => setForm(p => ({ ...p, fabric: e.target.value }))}>
                    <option value="">Select fabric...</option>
                    {fabrics.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </F>
                <F label="Weave Type">
                  <input className="input" list="weave-list" value={form.weaveType}
                    onChange={e => setForm(p => ({ ...p, weaveType: e.target.value }))}
                    placeholder="Type or select..." />
                  <datalist id="weave-list">
                    {weaveTypes.map(w => <option key={w} value={w} />)}
                  </datalist>
                </F>
                <F label="Origin / Region"><input className="input" value={form.originRegion} onChange={e => setForm(p => ({ ...p, originRegion: e.target.value }))} placeholder="Kanjivaram, Tamil Nadu..." /></F>
                <F label="Length (meters)"><input className="input" type="number" step="0.1" value={form.length} onChange={e => setForm(p => ({ ...p, length: e.target.value }))} /></F>
                <F label="Weight (grams)"><input className="input" type="number" value={form.weightGrams} onChange={e => setForm(p => ({ ...p, weightGrams: e.target.value }))} /></F>
                <F label="Description" col2><textarea className="input" style={{ height: 100, resize: 'none' }} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></F>
                <F label="Care Instructions" col2><input className="input" value={form.careInstructions} onChange={e => setForm(p => ({ ...p, careInstructions: e.target.value }))} /></F>
                <div className="col-span-2">
                  <p className="text-xs text-gray-600 font-medium mb-2">Occasion</p>
                  <div className="flex flex-wrap gap-2">
                    {OCCASIONS.map(o => <button key={o} type="button" onClick={() => setSelectedOccasions(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o])} className="px-3 py-1.5 text-xs border rounded transition-all" style={{ borderColor: selectedOccasions.includes(o) ? 'var(--crimson)' : '#E5E7EB', background: selectedOccasions.includes(o) ? 'var(--crimson)' : 'white', color: selectedOccasions.includes(o) ? 'white' : '#374151' }}>{o}</button>)}
                  </div>
                </div>
                <div className="col-span-2 flex gap-4">
                  {[['blouseIncluded','Blouse Piece Included'],['isFeatured','Featured Product'],['isBestseller','Mark as Bestseller'],['isActive','Published (Visible on store)']].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))} className="w-4 h-4" style={{ accentColor: 'var(--crimson)' }} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Pricing</h2>
              <div className="grid grid-cols-3 gap-4">
                <F label="Original Price (₹) *"><input className="input" type="number" value={form.originalPrice} onChange={e => setForm(p => ({ ...p, originalPrice: e.target.value }))} /></F>
                <F label="Sale Price (₹)"><input className="input" type="number" value={form.salePrice} onChange={e => setForm(p => ({ ...p, salePrice: e.target.value }))} /></F>
                <F label="GST Rate (%)"><select className="input" value={form.gstRate} onChange={e => setForm(p => ({ ...p, gstRate: e.target.value }))}><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option></select></F>
              </div>
            </div>

            {/* Colour variants */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Colour Variants & Stock</h2>
                <button type="button" onClick={() => setVariants(prev => [...prev, { colour: '', colourHex: '#8B1A2B', stock: 0, sku: '' }])} className="btn btn-secondary text-xs"><Plus size={12} /> Add Colour</button>
              </div>
              <div className="space-y-3">
                {variants.map((v, i) => (
                  <div key={i} className="flex gap-3 items-end">
                    <div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">Colour Name</label><input className="input" placeholder="e.g. Royal Red" value={v.colour} onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, colour: e.target.value } : x))} /></div>
                    <div><label className="text-xs text-gray-500 mb-1 block">Swatch</label><input type="color" value={v.colourHex} onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, colourHex: e.target.value } : x))} className="w-10 h-10 border rounded cursor-pointer" style={{ borderColor: '#E5E7EB', padding: 2 }} /></div>
                    <div className="w-24"><label className="text-xs text-gray-500 mb-1 block">Stock</label><input type="number" className="input" value={v.stock} onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, stock: Number(e.target.value) } : x))} /></div>
                    <div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">SKU</label><input className="input" placeholder="Optional" value={v.sku} onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, sku: e.target.value } : x))} /></div>
                    {variants.length > 1 && <button type="button" onClick={() => setVariants(prev => prev.filter((_, j) => j !== i))} className="mb-0.5 p-2 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="card p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Category</h2>
              <select className="input" value={form.categoryId} onChange={e => setForm(p => ({ ...p, categoryId: e.target.value }))}>
                <option value="">Select Category *</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Images */}
            <div className="card p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Product Images</h2>
              <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-red-300 transition-colors" style={{ borderColor: '#E5E7EB' }}>
                <Upload size={20} className="text-gray-400 mb-2" />
                <p className="text-xs text-gray-500 text-center">Click to upload images{uploading ? ' (Uploading...)' : ''}</p>
                <input type="file" className="hidden" multiple accept="image/*" onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(uploadImage) }} />
              </label>
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {images.map((img, i) => (
                    <div key={i} className="relative aspect-square border rounded overflow-hidden" style={{ borderColor: img.isPrimary ? 'var(--crimson)' : '#E5E7EB' }}>
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      {img.isPrimary && <span className="absolute top-0 left-0 right-0 text-center text-white text-xs py-0.5" style={{ background: 'var(--crimson)', fontSize: 9 }}>Primary</span>}
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center gap-1">
                        {!img.isPrimary && <button type="button" onClick={() => setImages(prev => prev.map((x, j) => ({ ...x, isPrimary: j === i })))} className="bg-white rounded px-1.5 py-0.5 text-xs opacity-0 hover:opacity-100" style={{ fontSize: 9 }}>Set Primary</button>}
                        <button type="button" onClick={() => setImages(prev => prev.filter((_, j) => j !== i))} className="bg-white rounded p-0.5 opacity-0 hover:opacity-100"><X size={10} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
