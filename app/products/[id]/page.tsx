'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function EditProductPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [form, setForm] = useState<any>(null)
  const [variants, setVariants] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: p } = await supabase.from('products').select('*').eq('id', params.id).single()
      const { data: v } = await supabase.from('product_variants').select('*').eq('product_id', params.id)
      setForm(p); setVariants(v || [])
    }
    load()
  }, [params.id])

  const save = async () => {
    if (!form) return
    setSaving(true)
    await supabase.from('products').update({ name: form.name, description: form.description, fabric: form.fabric, weave_type: form.weave_type, origin_region: form.origin_region, original_price: form.original_price, sale_price: form.sale_price || null, gst_rate: form.gst_rate, is_active: form.is_active, is_featured: form.is_featured, is_bestseller: form.is_bestseller, blouse_included: form.blouse_included, care_instructions: form.care_instructions, updated_at: new Date().toISOString() }).eq('id', params.id)
    for (const v of variants) {
      if (v.id) await supabase.from('product_variants').update({ colour: v.colour, colour_hex: v.colour_hex, stock: Number(v.stock) }).eq('id', v.id)
      else await supabase.from('product_variants').insert({ product_id: params.id, colour: v.colour, colour_hex: v.colour_hex, stock: Number(v.stock) })
    }
    toast.success('Product updated!'); setSaving(false)
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
        <div className="card p-5 space-y-4 mb-5">
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
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Variants & Stock</h2>
            <button onClick={() => setVariants(prev => [...prev, { colour: '', colour_hex: '#8B1A2B', stock: 0 }])} className="btn btn-secondary text-xs"><Plus size={12} /> Add</button>
          </div>
          <div className="space-y-3">
            {variants.map((v, i) => (
              <div key={i} className="flex gap-3 items-end">
                <div className="flex-1"><input className="input" placeholder="Colour Name" value={v.colour} onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, colour: e.target.value } : x))} /></div>
                <input type="color" value={v.colour_hex} onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, colour_hex: e.target.value } : x))} className="w-10 h-10 border rounded cursor-pointer" style={{ padding: 2 }} />
                <div className="w-24"><input type="number" className="input" placeholder="Stock" value={v.stock} onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, stock: e.target.value } : x))} /></div>
                <button onClick={() => setVariants(prev => prev.filter((_, j) => j !== i))} className="p-2 text-red-400"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
