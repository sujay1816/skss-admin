'use client'
import { useEffect, useState, useRef } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { Plus, Edit, Trash2, GripVertical, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Image from 'next/image'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [editId, setEditId] = useState<string|null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '', description: '', isActive: true, imageUrl: '' })
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('categories').select('*').order('display_order').then(({ data }) => setCategories(data || []))
  }, [])

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const uploadImage = async (file: File) => {
    setUploading(true)
    try {
      // Get Cloudinary config from site_config
      const { data: cfg } = await supabase.from('site_config').select('value').eq('key', 'cloudinary_cloud_name').single()
      const cloudName = cfg?.value || 'your_cloud_name'

      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', 'skss_banners') // reuse banners preset for categories
      formData.append('folder', 'skss/categories')

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.secure_url) {
        setForm(p => ({ ...p, imageUrl: data.secure_url }))
        toast.success('Image uploaded!')
      } else {
        toast.error('Upload failed')
      }
    } catch (e) {
      toast.error('Upload error')
    }
    setUploading(false)
  }

  const save = async () => {
    if (!form.name) return
    const slug = form.slug || slugify(form.name)
    if (editId) {
      const { data } = await supabase.from('categories')
        .update({ name: form.name, slug, description: form.description, is_active: form.isActive, image_url: form.imageUrl || null })
        .eq('id', editId).select().single()
      setCategories(prev => prev.map(c => c.id === editId ? data : c))
      toast.success('Category updated')
    } else {
      const maxOrder = Math.max(0, ...categories.map(c => c.display_order))
      const { data } = await supabase.from('categories')
        .insert({ name: form.name, slug, description: form.description, is_active: form.isActive, image_url: form.imageUrl || null, display_order: maxOrder + 1 })
        .select().single()
      setCategories(prev => [...prev, data])
      toast.success('Category created!')
    }
    reset()
  }

  const reset = () => {
    setEditId(null); setShowNew(false)
    setForm({ name: '', slug: '', description: '', isActive: true, imageUrl: '' })
  }

  const del = async (id: string) => {
    if (!confirm('Delete category? Products in this category will be uncategorized.')) return
    await supabase.from('categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
    toast.success('Category deleted')
  }

  const startEdit = (c: any) => {
    setEditId(c.id)
    setForm({ name: c.name, slug: c.slug, description: c.description || '', isActive: c.is_active, imageUrl: c.image_url || '' })
    setShowNew(false)
  }

  const Form = () => (
    <div className="card p-5 mb-5">
      <h3 className="font-semibold text-gray-900 mb-4">{editId ? 'Edit Category' : 'New Category'}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Name *</label>
          <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Slug (auto-generated)</label>
          <input className="input" value={form.slug || slugify(form.name)} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-600 mb-1 block">Description</label>
          <input className="input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>

        {/* Image upload */}
        <div className="col-span-2">
          <label className="text-xs text-gray-600 mb-2 block">Category Image (3:4 portrait recommended)</label>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { if (e.target.files?.[0]) uploadImage(e.target.files[0]) }} />
          {form.imageUrl ? (
            <div className="flex items-start gap-4">
              <div className="relative w-24 h-32 rounded overflow-hidden border border-gray-200 flex-shrink-0">
                <Image src={form.imageUrl} alt="Category" fill className="object-cover" />
              </div>
              <div className="flex flex-col gap-2 mt-1">
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="btn btn-secondary text-xs flex items-center gap-1">
                  <Upload size={12} /> {uploading ? 'Uploading...' : 'Change Image'}
                </button>
                <button onClick={() => setForm(p => ({ ...p, imageUrl: '' }))}
                  className="btn text-xs flex items-center gap-1 text-red-500 hover:bg-red-50 border border-red-200">
                  <X size={12} /> Remove Image
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="w-full h-28 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-gray-400 transition-colors">
              {uploading ? (
                <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Upload size={20} className="text-gray-400" />
                  <p className="text-xs text-gray-400">Click to upload category image</p>
                  <p className="text-xs text-gray-300">JPG, PNG, WebP · Max 5MB</p>
                </>
              )}
            </button>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-sm col-span-2">
          <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
            className="w-4 h-4" style={{ accentColor: 'var(--crimson)' }} />
          Active (visible in navigation)
        </label>
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={save} className="btn btn-primary">Save Category</button>
        <button onClick={reset} className="btn btn-secondary">Cancel</button>
      </div>
    </div>
  )

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
            <p className="text-sm text-gray-500">Manage categories — these appear in the storefront navigation</p>
          </div>
          <button onClick={() => { setShowNew(true); setEditId(null); setForm({ name: '', slug: '', description: '', isActive: true, imageUrl: '' }) }}
            className="btn btn-primary"><Plus size={16} /> New Category</button>
        </div>

        {(showNew || editId) && <Form />}

        <div className="card divide-y divide-gray-100">
          {categories.map(c => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50">
              <GripVertical size={14} className="text-gray-300" />
              {/* Show thumbnail if image exists */}
              {c.image_url ? (
                <div className="w-10 h-14 relative rounded overflow-hidden flex-shrink-0 border border-gray-100">
                  <Image src={c.image_url} alt={c.name} fill className="object-cover" />
                </div>
              ) : (
                <div className="w-10 h-14 rounded flex-shrink-0 border border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-xs">
                  No img
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{c.name}</p>
                  {!c.is_active && <span className="badge bg-gray-100 text-gray-500">Hidden</span>}
                </div>
                <p className="text-xs text-gray-400">/{c.slug} {c.description ? `· ${c.description}` : ''}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(c)} className="p-1.5 hover:bg-gray-100 rounded"><Edit size={14} style={{ color: 'var(--crimson)' }} /></button>
                <button onClick={() => del(c.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 size={14} className="text-red-400" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
