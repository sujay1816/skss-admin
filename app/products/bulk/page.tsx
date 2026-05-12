'use client'
import { useState, useEffect } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Upload, X, Save, Plus, Image as ImageIcon } from 'lucide-react'

const OCCASIONS = ['Wedding','Festive','Casual','Office','Party','Religious','Daily Wear']

interface BulkProduct {
  id: string
  imageFile: File | null
  imagePreview: string
  imageUrl: string
  uploading: boolean
  name: string
  description: string
  fabric: string
  weaveType: string
  originRegion: string
  categoryId: string
  originalPrice: string
  salePrice: string
  stock: string
  colour: string
  colourHex: string
  occasions: string[]
  careInstructions: string
  gstRate: string
  isFeatured: boolean
  isBestseller: boolean
}

const emptyProduct = (): BulkProduct => ({
  id: Math.random().toString(36).slice(2),
  imageFile: null, imagePreview: '', imageUrl: '',
  uploading: false, name: '', description: '', fabric: '', weaveType: '',
  originRegion: '', categoryId: '', originalPrice: '',
  salePrice: '', stock: '1', colour: '', colourHex: '#8B1A2B',
  occasions: [], careInstructions: 'Dry clean only',
  gstRate: '5', isFeatured: false, isBestseller: false,
})

export default function BulkProductPage() {
  const [rows, setRows] = useState<BulkProduct[]>([emptyProduct()])
  const [categories, setCategories] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [cloudName, setCloudName] = useState('')
  // Fix #2 — removed unused fileRefs ref
  const [fabrics, setFabrics] = useState<string[]>(['Silk','Cotton','Georgette','Chiffon','Linen','Organza','Net','Crepe','Tussar','Chanderi','Satin','Velvet','Khadi','Viscose'])
  const [weaveTypes] = useState<string[]>(['Kanjivaram','Banarasi','Chanderi','Tant','Patola','Sambalpuri','Ikkat','Jamdani','Phulkari','Gadwal','Paithani','Maheshwari','Bhagalpuri','Pochampally','Kasavu','Narayanpet','Handloom','Powerloom'])

  useEffect(() => {
    supabase.from('categories').select('id, name').eq('is_active', true).then(({ data }) => setCategories(data || []))
    supabase.from('site_config').select('key,value').in('key', ['cloudinary_cloud_name', 'fabric_types'])
      .then(({ data }) => {
        if (!data) return
        data.forEach((r: any) => {
          if (r.key === 'cloudinary_cloud_name' && r.value) setCloudName(r.value)
          if (r.key === 'fabric_types' && r.value) { try { setFabrics(JSON.parse(r.value)) } catch {} }
        })
      })
  }, [])

  const update = (id: string, field: keyof BulkProduct, value: any) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const uploadSingle = async (rowId: string, file: File): Promise<string> => {
    if (!cloudName) return ''
    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', 'skss_products')
    fd.append('folder', 'skss/products')
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd })
    const data = await res.json()
    return data.secure_url || ''
  }

  const handleImage = async (id: string, file: File) => {
    const preview = URL.createObjectURL(file)
    update(id, 'imageFile', file)
    update(id, 'imagePreview', preview)
    update(id, 'uploading', true)
    if (!cloudName) { toast.error('Set Cloudinary Cloud Name in Config first'); update(id, 'uploading', false); return }
    try {
      const url = await uploadSingle(id, file)
      update(id, 'imageUrl', url)
      toast.success('Image uploaded!')
    } catch { toast.error('Image upload failed') }
    update(id, 'uploading', false)
  }

  // Fix #9 — parallel image uploads using Promise.all
  const handleMultipleImages = async (files: FileList) => {
    const newRows: BulkProduct[] = Array.from(files).map(file => ({
      ...emptyProduct(),
      imageFile: file,
      imagePreview: URL.createObjectURL(file),
      name: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
        .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      uploading: true,
    }))
    setRows(prev => {
      const hasEmpty = prev.length === 1 && !prev[0].name && !prev[0].imagePreview
      return hasEmpty ? newRows : [...prev, ...newRows]
    })
    if (!cloudName) { newRows.forEach(r => update(r.id, 'uploading', false)); return }
    // Fix #9 — upload all images in parallel
    const uploads = newRows.map(async (row, i) => {
      try {
        const url = await uploadSingle(row.id, files[i])
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, imageUrl: url, uploading: false } : r))
      } catch {
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, uploading: false } : r))
      }
    })
    await Promise.all(uploads)
    toast.success(`${newRows.length} images uploaded!`)
  }

  const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id))
  const addRow = () => setRows(prev => [...prev, emptyProduct()])
  const toggleOccasion = (id: string, occ: string) => {
    setRows(prev => prev.map(r => r.id === id ? {
      ...r, occasions: r.occasions.includes(occ) ? r.occasions.filter(o => o !== occ) : [...r.occasions, occ]
    } : r))
  }

  const saveAll = async () => {
    const valid = rows.filter(r => r.name && r.originalPrice && r.categoryId && r.stock)
    if (valid.length === 0) { toast.error('Fill in at least Name, Price, Category and Stock'); return }
    if (valid.some(r => r.uploading)) { toast.error('Wait for images to finish uploading'); return }
    setSaving(true)
    let saved = 0
    for (const row of valid) {
      try {
        const slug = row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now()
        const { data: product, error } = await supabase.from('products').insert({
          name: row.name, slug, description: row.description,
          fabric: row.fabric, weave_type: row.weaveType,
          origin_region: row.originRegion, occasion: row.occasions,
          care_instructions: row.careInstructions, category_id: row.categoryId,
          original_price: Number(row.originalPrice),
          sale_price: row.salePrice ? Number(row.salePrice) : null,
          stock: Number(row.stock), gst_rate: Number(row.gstRate),
          is_featured: row.isFeatured, is_bestseller: row.isBestseller, is_active: true,
        }).select().single()
        if (error) throw error
        if (row.imageUrl) {
          await supabase.from('product_images').insert({
            product_id: product.id, url: row.imageUrl,
            public_id: row.imageUrl, is_primary: true, order_index: 0
          })
        }
        if (row.colour) {
          await supabase.from('product_variants').insert({
            product_id: product.id, colour: row.colour,
            colour_hex: row.colourHex, stock: Number(row.stock),
            sku: `${slug}-${row.colour.toLowerCase()}`, is_active: true,
          })
        }
        saved++
      } catch (e: any) { toast.error(`Failed: "${row.name}" — ${e.message}`) }
    }
    if (saved > 0) {
      toast.success(`${saved} product${saved > 1 ? 's' : ''} created!`)
      setRows([emptyProduct()])
    }
    setSaving(false)
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bulk Add Products</h1>
            <p className="text-sm text-gray-500 mt-0.5">Add multiple products at once</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={addRow} className="btn btn-secondary flex items-center gap-2">
              <Plus size={16} /> Add Row
            </button>
            <button type="button" onClick={saveAll} disabled={saving} className="btn btn-primary flex items-center gap-2">
              <Save size={16} />{saving ? 'Saving...' : `Save All (${rows.filter(r => r.name).length})`}
            </button>
          </div>
        </div>

        {/* Multi-image drop zone */}
        <div className="card p-5 mb-6" style={{ background: 'var(--cream)' }}>
          <h3 className="font-semibold text-gray-900 mb-2">📸 Quick Start — Drop Multiple Images</h3>
          <p className="text-sm text-gray-500 mb-3">Select multiple saree images at once. Each image creates a new row automatically.</p>
          <label className="flex items-center justify-center gap-3 border-2 border-dashed rounded-xl p-6 cursor-pointer hover:border-red-300" style={{ borderColor: '#E5E7EB' }}>
            <Upload size={20} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Click to select multiple images at once</span>
            <input type="file" multiple accept="image/*" className="hidden"
              onChange={e => e.target.files && e.target.files.length > 0 && handleMultipleImages(e.target.files)} />
          </label>
        </div>

        <div className="space-y-4">
          {rows.map((row, idx) => (
            <div key={row.id} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700">Product #{idx + 1}</h3>
                {rows.length > 1 && (
                  <button type="button" onClick={() => removeRow(row.id)} className="text-gray-400 hover:text-red-500">
                    <X size={18} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-12 gap-4">
                {/* Image */}
                <div className="col-span-12 sm:col-span-2">
                  <label className="block text-xs text-gray-600 font-medium mb-1">Image</label>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer h-32 overflow-hidden hover:border-red-300 relative" style={{ borderColor: '#E5E7EB' }}>
                    {row.imagePreview ? (
                      <img src={row.imagePreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <ImageIcon size={20} className="text-gray-300" />
                        <span className="text-xs text-gray-400">Upload</span>
                      </div>
                    )}
                    {row.uploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => e.target.files?.[0] && handleImage(row.id, e.target.files[0])} />
                  </label>
                  {row.imageUrl && <p className="text-xs text-green-600 mt-1 text-center">✅ Uploaded</p>}
                </div>

                {/* Fields */}
                <div className="col-span-12 sm:col-span-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-600 font-medium mb-1 block">Product Name *</label>
                    <input className="input" value={row.name} onChange={e => update(row.id, 'name', e.target.value)} placeholder="e.g. Kanjivaram Silk Saree" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">Category *</label>
                    <select className="input" value={row.categoryId} onChange={e => update(row.id, 'categoryId', e.target.value)}>
                      <option value="">Select...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  {/* Fix #3 — Fabric dropdown */}
                  <div>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">Fabric</label>
                    <select className="input" value={row.fabric} onChange={e => update(row.id, 'fabric', e.target.value)}>
                      <option value="">Select...</option>
                      {fabrics.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  {/* Fix #4 — Weave type field added */}
                  <div>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">Weave Type</label>
                    <input className="input" list={`weave-list-${row.id}`} value={row.weaveType}
                      onChange={e => update(row.id, 'weaveType', e.target.value)} placeholder="e.g. Kanjivaram" />
                    <datalist id={`weave-list-${row.id}`}>
                      {weaveTypes.map(w => <option key={w} value={w} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">Original Price (₹) *</label>
                    <input className="input" type="number" value={row.originalPrice} onChange={e => update(row.id, 'originalPrice', e.target.value)} placeholder="18000" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">Sale Price (₹)</label>
                    <input className="input" type="number" value={row.salePrice} onChange={e => update(row.id, 'salePrice', e.target.value)} placeholder="Optional" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">Stock *</label>
                    <input className="input" type="number" value={row.stock} onChange={e => update(row.id, 'stock', e.target.value)} placeholder="10" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">Origin Region</label>
                    <input className="input" value={row.originRegion} onChange={e => update(row.id, 'originRegion', e.target.value)} placeholder="Kanjivaram, TN" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">Colour</label>
                    <input className="input" value={row.colour} onChange={e => update(row.id, 'colour', e.target.value)} placeholder="Maroon" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">Colour Hex</label>
                    <div className="flex gap-2">
                      <input type="color" value={row.colourHex} onChange={e => update(row.id, 'colourHex', e.target.value)}
                        className="w-10 h-10 border rounded cursor-pointer p-0.5" style={{ borderColor: '#E5E7EB' }} />
                      <input className="input flex-1" value={row.colourHex} onChange={e => update(row.id, 'colourHex', e.target.value)} placeholder="#8B1A2B" />
                    </div>
                  </div>
                  {/* Fix #4 — Description field added */}
                  <div className="col-span-2">
                    <label className="text-xs text-gray-600 font-medium mb-1 block">Description</label>
                    <textarea className="input" rows={2} style={{ resize: 'none' }} value={row.description}
                      onChange={e => update(row.id, 'description', e.target.value)} placeholder="Brief product description..." />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-600 font-medium mb-1 block">Occasions</label>
                    <div className="flex flex-wrap gap-1">
                      {OCCASIONS.map(o => (
                        <button key={o} type="button" onClick={() => toggleOccasion(row.id, o)}
                          className="px-2 py-0.5 text-xs border rounded transition-all"
                          style={{ borderColor: row.occasions.includes(o) ? 'var(--crimson)' : '#E5E7EB', background: row.occasions.includes(o) ? 'var(--crimson)' : 'white', color: row.occasions.includes(o) ? 'white' : '#374151' }}>
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
                      <input type="checkbox" checked={row.isFeatured} onChange={e => update(row.id, 'isFeatured', e.target.checked)} style={{ accentColor: 'var(--crimson)' }} />
                      Featured
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
                      <input type="checkbox" checked={row.isBestseller} onChange={e => update(row.id, 'isBestseller', e.target.checked)} style={{ accentColor: 'var(--crimson)' }} />
                      Bestseller
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={addRow} className="btn btn-secondary flex items-center gap-2">
            <Plus size={16} /> Add Another Product
          </button>
          <button type="button" onClick={saveAll} disabled={saving} className="btn btn-primary flex items-center gap-2 flex-1 justify-center">
            <Save size={16} />{saving ? 'Creating Products...' : `Create ${rows.filter(r => r.name).length} Products`}
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}
