'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [editId, setEditId] = useState<string|null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '', description: '', isActive: true })

  useEffect(() => {
    supabase.from('categories').select('*').order('display_order').then(({ data }) => setCategories(data || []))
  }, [])

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const save = async () => {
    if (!form.name) return
    const slug = form.slug || slugify(form.name)
    if (editId) {
      const { data } = await supabase.from('categories').update({ name: form.name, slug, description: form.description, is_active: form.isActive }).eq('id', editId).select().single()
      setCategories(prev => prev.map(c => c.id === editId ? data : c))
      toast.success('Category updated')
    } else {
      const maxOrder = Math.max(0, ...categories.map(c => c.display_order))
      const { data } = await supabase.from('categories').insert({ name: form.name, slug, description: form.description, is_active: form.isActive, display_order: maxOrder + 1 }).select().single()
      setCategories(prev => [...prev, data])
      toast.success('Category created! It will appear in the storefront navigation.')
    }
    setEditId(null); setShowNew(false); setForm({ name: '', slug: '', description: '', isActive: true })
  }

  const del = async (id: string) => {
    if (!confirm('Delete category? Products in this category will be uncategorized.')) return
    await supabase.from('categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
    toast.success('Category deleted')
  }

  const startEdit = (c: any) => { setEditId(c.id); setForm({ name: c.name, slug: c.slug, description: c.description || '', isActive: c.is_active }); setShowNew(false) }

  const Form = () => (
    <div className="card p-5 mb-5">
      <h3 className="font-semibold text-gray-900 mb-4">{editId ? 'Edit Category' : 'New Category'}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="text-xs text-gray-600 mb-1 block">Name *</label><input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
        <div><label className="text-xs text-gray-600 mb-1 block">Slug (auto-generated)</label><input className="input" value={form.slug || slugify(form.name)} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} /></div>
        <div className="col-span-2"><label className="text-xs text-gray-600 mb-1 block">Description</label><input className="input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
        <label className="flex items-center gap-2 cursor-pointer text-sm col-span-2"><input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4" style={{ accentColor: 'var(--crimson)' }} />Active (visible in navigation)</label>
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={save} className="btn btn-primary">Save Category</button>
        <button onClick={() => { setEditId(null); setShowNew(false); setForm({ name: '', slug: '', description: '', isActive: true }) }} className="btn btn-secondary">Cancel</button>
      </div>
    </div>
  )

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-2xl font-bold text-gray-900">Categories</h1><p className="text-sm text-gray-500">Manage categories — these appear in the storefront navigation</p></div>
          <button onClick={() => { setShowNew(true); setEditId(null); setForm({ name: '', slug: '', description: '', isActive: true }) }} className="btn btn-primary"><Plus size={16} /> New Category</button>
        </div>
        {(showNew || editId) && <Form />}
        <div className="card divide-y divide-gray-100">
          {categories.map(c => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50">
              <GripVertical size={14} className="text-gray-300" />
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
