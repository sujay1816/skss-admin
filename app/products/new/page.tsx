'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Upload, X, Image as ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'

const OCCASIONS = ['Wedding','Festive','Casual','Office','Party','Religious','Daily Wear']
const ALLOWED_IMAGE_TYPES = ['image/jpeg','image/jpg','image/png','image/webp']
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

const F = ({ label, children, col2 }: { label: string; children: React.ReactNode; col2?: boolean }) => (
  <div className={col2 ? 'col-span-2' : ''}><label className="text-xs text-gray-600 font-medium mb-1 block">{label}</label>{children}</div>
)

type Variant = { colour: string; colourHex: string; stock: number; sku: string; imageUrl: string; imageFile?: File }

export default function NewProductPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<{ file?: File; url: string; publicId: string; isPrimary: boolean }[]>([])
  const [uploading, setUploading] = useState(false)
  const [isSinglePiece, setIsSinglePiece] = useState(false)
  const [singleStock, setSingleStock] = useState(1)
  const [variants, setVariants] = useState<Variant[]>([{ colour: '', colourHex: '#8B1A2B', stock: 1, sku: '', imageUrl: '' }])
  const [uploadingVariantIdx, setUploadingVariantIdx] = useState<number | null>(null)
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([])
  const [fabrics, setFabrics] = useState<string[]>(['Silk','Cotton','Georgette','Chiffon','Linen','Organza','Net','Crepe','Tussar','Chanderi','Satin','Velvet','Khadi','Viscose'])
  const [weaveTypes, setWeaveTypes] = useState<string[]>(['Kanjivaram','Banarasi','Chanderi','Tant','Patola','Sambalpuri','Ikkat','Jamdani','Phulkari','Gadwal','Paithani','Maheshwari','Bhagalpuri','Pochampally','Kasavu','Narayanpet','Handloom','Powerloom'])
  const [form, setForm] = useState({ name: '', slug: '', description: '', fabric: '', weaveType: '', originRegion: '', careInstructions: 'Dry clean only', blouseIncluded: false, length: '5.5', weightGrams: '', categoryId: '', originalPrice: '', salePrice: '', discountPercent: '', gstRate: '5', isFeatured: false, isBestseller: false, isActive: true })

  useEffect(() => {
    supabase.from('categories').select('id,name').eq('is_active', true).then(({ data }) => setCategories(data || []))
    supabase.from('site_config').select('value').eq('key', 'fabric_types').single().then(({ data }) => {
      if (data?.value) try { setFabrics(JSON.parse(data.value)) } catch {}
    })
  }, [])

  const getCloudinaryName = async () => {
    const { data: cfg } = await supabase.from('site_config').select('key,value').in('key', ['cloudinary_cloud_name'])
    const config: Record<string, string> = {}
    cfg?.forEach((c: any) => { config[c.key] = c.value })
    return config.cloudinary_cloud_name || ''
  }

  const uploadToCloudinary = async (file: File, folder = 'skss/products'): Promise<string> => {
    const cloudName = await getCloudinaryName()
    if (!cloudName) return URL.createObjectURL(file)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', 'skss_products')
    fd.append('folder', folder)
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd })
    const data = await res.json()
    return data.secure_url || ''
  }

  const validateImage = (file: File): boolean => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error('Use JPEG, PNG or WebP only'); return false }
    if (file.size > MAX_IMAGE_SIZE_BYTES) { toast.error('Max 5MB per image'); return false }
    return true
  }

  const uploadProductImage = async (file: File) => {
    if (!validateImage(file)) return
    setUploading(true)
    const cloudName = await getCloudinaryName()
    if (!cloudName) {
      const url = URL.createObjectURL(file)
      setImages(prev => [...prev, { file, url, publicId: '', isPrimary: prev.length === 0 }])
      setUploading(false); return
    }
    const fd = new FormData()
    fd.append('file', file); fd.append('upload_preset', 'skss_products')
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd })
    const data = await res.json()
    setImages(prev => [...prev, { url: data.secure_url, publicId: data.public_id, isPrimary: prev.length === 0 }])
    setUploading(false)
  }

  const uploadVariantImage = async (file: File, idx: number) => {
    if (!validateImage(file)) return
    setUploadingVariantIdx(idx)
    try {
      const url = await uploadToCloudinary(file, 'skss/variants')
      setVariants(prev => prev.map((v, i) => i === idx ? { ...v, imageUrl: url } : v))
      toast.success('Colour image uploaded!')
    } catch { toast.error('Upload failed') }
    setUploadingVariantIdx(null)
  }

  const genSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).substr(2, 4)

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Product name is required'); return }
    if (!form.categoryId) { toast.error('Please select a category'); return }
    if (!form.originalPrice) { toast.error('Original price is required'); return }
    const origPrice = Number(form.originalPrice)
    const salePrice = form.salePrice ? Number(form.salePrice) : null
    if (origPrice <= 0) { toast.error('Original price must be greater than ₹0'); return }
    if (salePrice !== null && salePrice >= origPrice) { toast.error('Sale price must be less than original price'); return }

    setLoading(true)
    const slug = form.slug || genSlug(form.name)
    try {
      const { data: product, error } = await supabase.from('products').insert({
        name: form.name, slug, description: form.description, fabric: form.fabric, weave_type: form.weaveType,
        origin_region: form.originRegion, occasion: selectedOccasions, care_instructions: form.careInstructions,
        blouse_included: form.blouseIncluded, length: Number(form.length) || 5.5, weight_grams: Number(form.weightGrams) || 0,
        category_id: form.categoryId, original_price: origPrice, sale_price: salePrice,
        discount_percent: form.discountPercent ? Number(form.discountPercent) : null,
        gst_rate: Number(form.gstRate), is_featured: form.isFeatured, is_bestseller: form.isBestseller, is_active: form.isActive
      }).select().single()
      if (error) throw error

      if (images.length > 0) {
        await supabase.from('product_images').insert(
          images.map((img, i) => ({ product_id: product.id, url: img.url, public_id: img.publicId, is_primary: img.isPrimary, order_index: i }))
        )
      }

      // Build variants
      let variantsToInsert: any[]
      if (isSinglePiece) {
        variantsToInsert = [{ product_id: product.id, colour: 'Single Piece', colour_hex: '#8B1A2B', stock: singleStock, sku: `${slug}-single`, image_url: null }]
      } else {
        const validVariants = variants.filter(v => v.colour.trim())
        variantsToInsert = validVariants.length > 0
          ? validVariants.map(v => ({
              product_id: product.id, colour: v.colour, colour_hex: v.colourHex,
              stock: Math.max(0, Number(v.stock)), sku: v.sku || `${slug}-${v.colour.toLowerCase().replace(/\s+/g,'-')}`,
              image_url: v.imageUrl || null,
            }))
          : [{ product_id: product.id, colour: 'Default', colour_hex: '#8B1A2B', stock: variants[0] ? Number(variants[0].stock) : 0, sku: `${slug}-default`, image_url: null }]
      }
      await supabase.from('product_variants').insert(variantsToInsert)
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
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="form-grid-2">
                <F label="Product Name *" col2><input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value, slug: '' }))} /></F>
                <F label="Fabric Type">
                  <select className="input" value={form.fabric} onChange={e => setForm(p => ({ ...p, fabric: e.target.value }))}>
                    <option value="">Select fabric...</option>
                    {fabrics.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </F>
                <F label="Weave Type">
                  <input className="input" list="weave-list" value={form.weaveType} onChange={e => setForm(p => ({ ...p, weaveType: e.target.value }))} placeholder="Type or select..." />
                  <datalist id="weave-list">{weaveTypes.map(w => <option key={w} value={w} />)}</datalist>
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
                <div className="col-span-2 flex gap-4 flex-wrap">
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
              <div className="form-grid-3">
                <F label="Original Price (₹) *">
                  <input className="input" type="number" min="1" value={form.originalPrice} onChange={e => setForm(p => ({ ...p, originalPrice: e.target.value }))} />
                </F>
                <F label="Sale Price (₹)">
                  <input className="input" type="number" min="1" value={form.salePrice} onChange={e => setForm(p => ({ ...p, salePrice: e.target.value }))} />
                  {form.salePrice && form.originalPrice && Number(form.salePrice) >= Number(form.originalPrice) && (
                    <p className="text-xs text-red-500 mt-0.5">Must be less than ₹{form.originalPrice}</p>
                  )}
                </F>
                <F label="GST Rate (%)">
                  <select className="input" value={form.gstRate} onChange={e => setForm(p => ({ ...p, gstRate: e.target.value }))}>
                    <option value="5">5%</option><option value="12">12%</option><option value="18">18%</option>
                  </select>
                </F>
              </div>
            </div>

            {/* Variants / Single Piece */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Colours & Stock</h2>
                {/* Single piece toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setIsSinglePiece(p => !p)}
                    className="relative w-10 h-5 rounded-full transition-colors cursor-pointer"
                    style={{ background: isSinglePiece ? 'var(--crimson)' : '#D1D5DB' }}
                  >
                    <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                      style={{ left: isSinglePiece ? '22px' : '2px' }} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Single piece (no colours)</span>
                </label>
              </div>

              {isSinglePiece ? (
                <div className="p-4 rounded-lg" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <p className="text-sm text-gray-600 mb-3">This product is a single piece with no colour variants.</p>
                  <div className="w-32">
                    <label className="text-xs text-gray-500 mb-1 block">Stock Quantity</label>
                    <input type="number" min="0" className="input" value={singleStock}
                      onChange={e => setSingleStock(Math.max(0, Number(e.target.value)))} />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">Upload a photo for each colour — customers will see these thumbnails to pick their colour (like Myntra).</p>
                  {variants.map((v, i) => (
                    <div key={i} className="border rounded-lg p-4" style={{ borderColor: '#E5E7EB' }}>
                      <div className="flex gap-3 items-start">
                        {/* Colour image upload */}
                        <div className="flex-shrink-0">
                          <label className="text-xs text-gray-500 mb-1 block">Colour Photo</label>
                          <div className="relative">
                            {v.imageUrl ? (
                              <div className="relative w-20 h-24 border-2 rounded overflow-hidden" style={{ borderColor: 'var(--crimson)' }}>
                                <img src={v.imageUrl} alt={v.colour} className="w-full h-full object-cover" />
                                <button type="button"
                                  onClick={() => setVariants(prev => prev.map((x, j) => j === i ? { ...x, imageUrl: '' } : x))}
                                  className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5">
                                  <X size={10} className="text-white" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center w-20 h-24 border-2 border-dashed rounded cursor-pointer hover:border-red-300 transition-colors"
                                style={{ borderColor: '#E5E7EB', background: '#F9FAFB' }}>
                                {uploadingVariantIdx === i
                                  ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                  : <><ImageIcon size={16} className="text-gray-400 mb-1" /><span className="text-xs text-gray-400 text-center">Add photo</span></>
                                }
                                <input type="file" className="hidden" accept="image/*"
                                  onChange={e => e.target.files?.[0] && uploadVariantImage(e.target.files[0], i)} />
                              </label>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <div className="col-span-2 flex gap-3">
                            <div className="flex-1">
                              <label className="text-xs text-gray-500 mb-1 block">Colour Name *</label>
                              <input className="input" placeholder="e.g. Royal Red" value={v.colour}
                                onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, colour: e.target.value } : x))} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Swatch</label>
                              <input type="color" value={v.colourHex}
                                onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, colourHex: e.target.value } : x))}
                                className="w-10 h-10 border rounded cursor-pointer" style={{ borderColor: '#E5E7EB', padding: 2 }} />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Stock</label>
                            <input type="number" min="0" className="input" value={v.stock}
                              onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, stock: Math.max(0, Number(e.target.value)) } : x))} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">SKU (optional)</label>
                            <input className="input" placeholder="Auto-generated" value={v.sku}
                              onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, sku: e.target.value } : x))} />
                          </div>
                        </div>

                        {variants.length > 1 && (
                          <button type="button" onClick={() => setVariants(prev => prev.filter((_, j) => j !== i))}
                            className="p-2 text-red-400 hover:text-red-600 flex-shrink-0">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button type="button"
                    onClick={() => setVariants(prev => [...prev, { colour: '', colourHex: '#8B1A2B', stock: 1, sku: '', imageUrl: '' }])}
                    className="btn btn-secondary text-xs w-full justify-center">
                    <Plus size={12} /> Add Another Colour
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Category</h2>
              <select className="input" value={form.categoryId} onChange={e => setForm(p => ({ ...p, categoryId: e.target.value }))}>
                <option value="">Select Category *</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="card p-4">
              <h2 className="font-semibold text-gray-900 mb-1">Product Images</h2>
              <p className="text-xs text-gray-400 mb-3">Main product photos — shown in the gallery on the product page.</p>
              <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-red-300 transition-colors" style={{ borderColor: '#E5E7EB' }}>
                <Upload size={20} className="text-gray-400 mb-2" />
                <p className="text-xs text-gray-500 text-center">{uploading ? 'Uploading...' : 'Click to upload images'}</p>
                <p className="text-xs text-gray-400 mt-0.5">JPEG, PNG, WebP · Max 5MB</p>
                <input type="file" className="hidden" multiple accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(uploadProductImage) }} />
              </label>
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {images.map((img, i) => (
                    <div key={i} className="relative aspect-square border rounded overflow-hidden" style={{ borderColor: img.isPrimary ? 'var(--crimson)' : '#E5E7EB' }}>
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      {img.isPrimary && <span className="absolute top-0 left-0 right-0 text-center text-white py-0.5" style={{ background: 'var(--crimson)', fontSize: 9 }}>Primary</span>}
                      <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 hover:opacity-100 bg-black/20 transition-opacity">
                        {!img.isPrimary && <button type="button" onClick={() => setImages(prev => prev.map((x, j) => ({ ...x, isPrimary: j === i })))} className="bg-white rounded px-1 py-0.5" style={{ fontSize: 9 }}>Primary</button>}
                        <button type="button" onClick={() => setImages(prev => prev.filter((_, j) => j !== i))} className="bg-white rounded p-0.5"><X size={10} /></button>
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
