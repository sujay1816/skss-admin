'use client'
import { useState, useEffect, useRef } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Upload, Save, Download, Search } from 'lucide-react'

interface ProductStock {
  id: string
  name: string
  fabric: string
  category: string
  stock: number
  newStock: number
  changed: boolean
}

export default function StockPage() {
  const [products, setProducts] = useState<ProductStock[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'editor' | 'csv'>('editor')
  const [csvPreview, setCsvPreview] = useState<any[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadProducts() }, [])

  const loadProducts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('id, name, fabric, stock, categories(name)')
      .eq('is_active', true)
      .order('name')
    if (data) {
      setProducts(data.map((p: any) => ({
        id: p.id, name: p.name, fabric: p.fabric || '',
        category: p.categories?.name || '',
        stock: p.stock || 0, newStock: p.stock || 0, changed: false,
      })))
    }
    setLoading(false)
  }

  const updateStock = (id: string, value: number) => {
    setProducts(prev => prev.map(p => p.id === id
      ? { ...p, newStock: Math.max(0, value), changed: p.stock !== Math.max(0, value) } : p))
  }

  const saveAll = async () => {
    const changed = products.filter(p => p.changed)
    if (changed.length === 0) { toast.error('No changes to save'); return }
    setSaving(true)
    try {
      for (const p of changed) {
        await supabase.from('products').update({ stock: p.newStock }).eq('id', p.id)
        const { data: variants } = await supabase.from('product_variants').select('id').eq('product_id', p.id)
        if (variants && variants.length > 0) {
          const perVariant = Math.floor(p.newStock / variants.length)
          const remainder = p.newStock % variants.length
          for (let i = 0; i < variants.length; i++) {
            await supabase.from('product_variants')
              .update({ stock: perVariant + (i === 0 ? remainder : 0) }).eq('id', variants[i].id)
          }
        }
      }
      toast.success(`${changed.length} product${changed.length > 1 ? 's' : ''} updated!`)
      loadProducts()
    } catch (e: any) { toast.error('Save failed: ' + e.message) }
    setSaving(false)
  }

  const handleCSVFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.trim().split('\n')
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''))
      const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('product'))
      const stockIdx = headers.findIndex(h => h.includes('stock') || h.includes('qty'))
      if (nameIdx === -1 || stockIdx === -1) { toast.error('CSV must have "name" and "stock" columns'); return }
      const rows = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim().replace(/"/g, ''))
        return { name: cols[nameIdx], stock: parseInt(cols[stockIdx]) || 0 }
      }).filter(r => r.name)
      setCsvPreview(rows)
    }
    reader.readAsText(file)
  }

  const applyCSV = async () => {
    if (csvPreview.length === 0) return
    setSaving(true)
    let updated = 0, notFound = 0
    for (const row of csvPreview) {
      const match = products.find(p =>
        p.name.toLowerCase().includes(row.name.toLowerCase()) ||
        row.name.toLowerCase().includes(p.name.toLowerCase()))
      if (match) {
        await supabase.from('products').update({ stock: row.stock }).eq('id', match.id)
        const { data: variants } = await supabase.from('product_variants').select('id').eq('product_id', match.id)
        if (variants && variants.length > 0) {
          const perVariant = Math.floor(row.stock / variants.length)
          const remainder = row.stock % variants.length
          for (let i = 0; i < variants.length; i++) {
            await supabase.from('product_variants')
              .update({ stock: perVariant + (i === 0 ? remainder : 0) }).eq('id', variants[i].id)
          }
        }
        updated++
      } else notFound++
    }
    toast.success(`Updated ${updated} products${notFound > 0 ? `. ${notFound} not found.` : ''}`)
    setCsvPreview([])
    loadProducts()
    setSaving(false)
  }

  const downloadTemplate = () => {
    const rows = ['Product Name,Stock,Notes']
    products.forEach(p => rows.push(`"${p.name}",${p.stock},`))
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = 'skss-stock-template.csv'; a.click()
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase()))
  const changedCount = products.filter(p => p.changed).length

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Update product stock levels</p>
          </div>
          {tab === 'editor' && changedCount > 0 && (
            <button onClick={saveAll} disabled={saving} className="btn btn-primary flex items-center gap-2">
              <Save size={16} />{saving ? 'Saving...' : `Save ${changedCount} Changes`}
            </button>
          )}
        </div>

        <div className="flex gap-0 mb-6 border-b border-gray-200">
          {[['editor', '📋 Inline Editor'], ['csv', '📄 CSV Upload']].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t as any)}
              className="px-5 py-3 text-sm font-medium border-b-2 transition-all"
              style={{ borderBottomColor: tab === t ? 'var(--crimson)' : 'transparent', color: tab === t ? 'var(--crimson)' : '#6B7280' }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'editor' && (
          <>
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {loading ? (
              <div className="text-center py-12"><div className="inline-block w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--crimson)', borderTopColor: 'transparent' }} /></div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead style={{ background: 'var(--cream)' }}>
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Product</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Category</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase w-28">Current</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase w-36">New Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, i) => (
                      <tr key={p.id} style={{ background: p.changed ? '#FFFBEB' : i % 2 === 0 ? 'white' : '#FDFAF7', borderTop: '1px solid #F0E8E0' }}>
                        <td className="px-4 py-3"><p className="text-sm font-medium text-gray-900">{p.name}</p><p className="text-xs text-gray-400">{p.fabric}</p></td>
                        <td className="px-4 py-3 text-sm text-gray-500">{p.category}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm font-semibold ${p.stock === 0 ? 'text-red-500' : p.stock < 5 ? 'text-orange-500' : 'text-green-600'}`}>{p.stock}</span>
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" min="0" value={p.newStock}
                            onChange={e => updateStock(p.id, parseInt(e.target.value) || 0)}
                            className="w-full text-center border rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none"
                            style={{ borderColor: p.changed ? '#F59E0B' : '#E5E7EB', background: p.changed ? '#FFFBEB' : 'white' }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && <div className="text-center py-8 text-sm text-gray-500">No products found</div>}
              </div>
            )}
            {changedCount > 0 && (
              <div className="sticky bottom-4 mt-4 flex justify-end">
                <button onClick={saveAll} disabled={saving} className="btn btn-primary shadow-lg flex items-center gap-2">
                  <Save size={16} />{saving ? 'Saving...' : `Save ${changedCount} Changes`}
                </button>
              </div>
            )}
          </>
        )}

        {tab === 'csv' && (
          <div className="space-y-5">
            {/* Instructions */}
            <div className="card p-5" style={{ background: 'var(--cream)' }}>
              <h3 className="font-semibold text-gray-900 mb-3">📋 CSV Instructions</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>1. Download the template — it has all your products pre-filled</p>
                <p>2. Open in Excel or Google Sheets</p>
                <p>3. Edit only the <strong>Stock</strong> column (do NOT change product names)</p>
                <p>4. Save as CSV → upload here → check preview → click Apply</p>
                <p className="text-xs text-gray-400 mt-2">✅ Partial name match works &nbsp;|&nbsp; ✅ Numbers only for stock &nbsp;|&nbsp; ❌ No decimals</p>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Step 1 — Download Template</h3>
              <button onClick={downloadTemplate} className="btn btn-secondary flex items-center gap-2">
                <Download size={16} /> Download CSV Template ({products.length} products)
              </button>
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Step 2 — Upload Updated CSV</h3>
              <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors hover:border-red-300" style={{ borderColor: '#E5E7EB' }}>
                <Upload size={24} className="text-gray-400 mb-2" />
                <p className="text-sm font-medium text-gray-600">Click to upload CSV</p>
                <p className="text-xs text-gray-400 mt-1">Must have "Product Name" and "Stock" columns</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden"
                  onChange={e => e.target.files?.[0] && handleCSVFile(e.target.files[0])} />
              </label>
            </div>

            {csvPreview.length > 0 && (
              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Step 3 — Preview & Apply</h3>
                <div className="overflow-auto max-h-64 mb-4 border rounded-lg" style={{ borderColor: '#E5E7EB' }}>
                  <table className="w-full text-sm">
                    <thead style={{ background: 'var(--cream)' }}>
                      <tr>
                        <th className="text-left px-4 py-2 font-semibold text-gray-600">Product Name</th>
                        <th className="text-center px-4 py-2 font-semibold text-gray-600">New Stock</th>
                        <th className="text-center px-4 py-2 font-semibold text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, i) => {
                        const match = products.find(p =>
                          p.name.toLowerCase().includes(row.name.toLowerCase()) ||
                          row.name.toLowerCase().includes(p.name.toLowerCase()))
                        return (
                          <tr key={i} style={{ borderTop: '1px solid #F0E8E0', background: i % 2 === 0 ? 'white' : '#FDFAF7' }}>
                            <td className="px-4 py-2 text-gray-900">{row.name}</td>
                            <td className="px-4 py-2 text-center font-semibold" style={{ color: 'var(--crimson)' }}>{row.stock}</td>
                            <td className="px-4 py-2 text-center">{match ? <span className="text-green-600 text-xs font-medium">✅ Matched</span> : <span className="text-red-500 text-xs">❌ Not found</span>}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setCsvPreview([])} className="btn btn-secondary flex-1">Clear</button>
                  <button onClick={applyCSV} disabled={saving} className="btn btn-primary flex-1">
                    {saving ? 'Applying...' : `Apply Updates`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
