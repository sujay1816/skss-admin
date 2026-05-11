'use client'
import { useState, useEffect, useRef } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Upload, Save, Download, Search, ChevronDown, ChevronUp } from 'lucide-react'

interface VariantStock {
  id: string
  colour: string
  colour_hex: string
  stock: number
  newStock: number
  changed: boolean
}

interface ProductStock {
  id: string
  name: string
  fabric: string
  category: string
  totalStock: number
  variants: VariantStock[]
  expanded: boolean
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
      .select('id, name, fabric, stock, categories(name), product_variants(id, colour, colour_hex, stock)')
      .eq('is_active', true)
      .order('name')
    if (data) {
      setProducts(data.map((p: any) => ({
        id: p.id,
        name: p.name,
        fabric: p.fabric || '',
        category: p.categories?.name || '',
        totalStock: (p.product_variants || []).reduce((s: number, v: any) => s + v.stock, 0),
        variants: (p.product_variants || []).map((v: any) => ({
          id: v.id,
          colour: v.colour,
          colour_hex: v.colour_hex || '#8B1A2B',
          stock: v.stock,
          newStock: v.stock,
          changed: false,
        })),
        expanded: false,
      })))
    }
    setLoading(false)
  }

  // Issue 7 fix — update per-variant stock directly
  const updateVariantStock = (productId: string, variantId: string, value: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p
      const updatedVariants = p.variants.map(v =>
        v.id === variantId
          ? { ...v, newStock: Math.max(0, value), changed: v.stock !== Math.max(0, value) }
          : v
      )
      return { ...p, variants: updatedVariants }
    }))
  }

  const toggleExpand = (productId: string) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, expanded: !p.expanded } : p))
  }

  const saveAll = async () => {
    const changedVariants: { productId: string; variantId: string; newStock: number }[] = []
    products.forEach(p => {
      p.variants.forEach(v => {
        if (v.changed) changedVariants.push({ productId: p.id, variantId: v.id, newStock: v.newStock })
      })
    })
    if (changedVariants.length === 0) { toast.error('No changes to save'); return }
    setSaving(true)
    try {
      // Update each variant individually
      for (const cv of changedVariants) {
        await supabase.from('product_variants').update({ stock: cv.newStock }).eq('id', cv.variantId)
      }
      // Update product total stock for each affected product
      const affectedProductIds = [...new Set(changedVariants.map(cv => cv.productId))]
      for (const productId of affectedProductIds) {
        const { data: vars } = await supabase.from('product_variants').select('stock').eq('product_id', productId)
        const totalStock = (vars || []).reduce((s: number, v: any) => s + v.stock, 0)
        await supabase.from('products').update({ stock: totalStock }).eq('id', productId)
      }
      toast.success(`${changedVariants.length} variant${changedVariants.length > 1 ? 's' : ''} updated!`)
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
      const colourIdx = headers.findIndex(h => h.includes('colour') || h.includes('color') || h.includes('variant'))
      const stockIdx = headers.findIndex(h => h.includes('stock') || h.includes('qty'))
      if (nameIdx === -1 || stockIdx === -1) { toast.error('CSV must have "name" and "stock" columns'); return }
      const rows = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim().replace(/"/g, ''))
        return { name: cols[nameIdx], colour: colourIdx !== -1 ? cols[colourIdx] : '', stock: parseInt(cols[stockIdx]) || 0 }
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
      const matchProduct = products.find(p =>
        p.name.toLowerCase().includes(row.name.toLowerCase()) ||
        row.name.toLowerCase().includes(p.name.toLowerCase()))
      if (matchProduct) {
        if (row.colour) {
          // Update specific variant
          const matchVariant = matchProduct.variants.find(v =>
            v.colour.toLowerCase().includes(row.colour.toLowerCase()))
          if (matchVariant) {
            await supabase.from('product_variants').update({ stock: row.stock }).eq('id', matchVariant.id)
            updated++
          } else notFound++
        } else {
          // No colour specified — distribute evenly across variants
          const perVariant = Math.floor(row.stock / Math.max(1, matchProduct.variants.length))
          for (const v of matchProduct.variants) {
            await supabase.from('product_variants').update({ stock: perVariant }).eq('id', v.id)
          }
          await supabase.from('products').update({ stock: row.stock }).eq('id', matchProduct.id)
          updated++
        }
      } else notFound++
    }
    toast.success(`Updated ${updated} rows${notFound > 0 ? `. ${notFound} not found.` : ''}`)
    setCsvPreview([])
    loadProducts()
    setSaving(false)
  }

  const downloadTemplate = () => {
    const rows = ['Product Name,Colour,Stock,Notes']
    products.forEach(p => {
      if (p.variants.length > 0) {
        p.variants.forEach(v => rows.push(`"${p.name}","${v.colour}",${v.stock},`))
      } else {
        rows.push(`"${p.name}",,${p.totalStock},`)
      }
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = 'skss-stock-template.csv'; a.click()
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase()))

  const totalChanges = products.reduce((s, p) => s + p.variants.filter(v => v.changed).length, 0)

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Update stock per colour variant</p>
          </div>
          {tab === 'editor' && totalChanges > 0 && (
            <button onClick={saveAll} disabled={saving} className="btn btn-primary flex items-center gap-2">
              <Save size={16} />{saving ? 'Saving...' : `Save ${totalChanges} Changes`}
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
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--crimson)', borderTopColor: 'transparent' }} />
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(p => {
                  const hasChanges = p.variants.some(v => v.changed)
                  return (
                    <div key={p.id} className="card overflow-hidden" style={{ borderColor: hasChanges ? '#F59E0B' : undefined }}>
                      {/* Product header row */}
                      <div
                        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleExpand(p.id)}>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.category}{p.fabric ? ` · ${p.fabric}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold ${p.totalStock === 0 ? 'text-red-500' : p.totalStock < 5 ? 'text-orange-500' : 'text-green-600'}`}>
                            {p.totalStock} total
                          </span>
                          {hasChanges && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Unsaved</span>}
                          <span className="text-xs text-gray-400">{p.variants.length} variant{p.variants.length !== 1 ? 's' : ''}</span>
                          {p.expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        </div>
                      </div>

                      {/* Variant rows — Issue 7 fix: per-variant stock editing */}
                      {p.expanded && (
                        <div className="border-t border-gray-100">
                          {p.variants.length === 0 ? (
                            <p className="text-xs text-gray-400 px-4 py-3">No colour variants found</p>
                          ) : (
                            p.variants.map(v => (
                              <div key={v.id} className="flex items-center gap-4 px-4 py-2.5 border-b last:border-0 border-gray-50"
                                style={{ background: v.changed ? '#FFFBEB' : 'white' }}>
                                <div className="w-4 h-4 rounded-full border flex-shrink-0"
                                  style={{ background: v.colour_hex, borderColor: '#E5E7EB' }} />
                                <p className="text-sm text-gray-700 flex-1">{v.colour}</p>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-gray-400">Current: <strong>{v.stock}</strong></span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={v.newStock}
                                    onChange={e => updateVariantStock(p.id, v.id, parseInt(e.target.value) || 0)}
                                    className="w-24 text-center border rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none"
                                    style={{ borderColor: v.changed ? '#F59E0B' : '#E5E7EB', background: v.changed ? '#FFFBEB' : 'white' }}
                                  />
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                {filtered.length === 0 && <div className="text-center py-8 text-sm text-gray-500">No products found</div>}
              </div>
            )}

            {totalChanges > 0 && (
              <div className="sticky bottom-4 mt-4 flex justify-end">
                <button onClick={saveAll} disabled={saving} className="btn btn-primary shadow-lg flex items-center gap-2">
                  <Save size={16} />{saving ? 'Saving...' : `Save ${totalChanges} Changes`}
                </button>
              </div>
            )}
          </>
        )}

        {tab === 'csv' && (
          <div className="space-y-5">
            <div className="card p-5" style={{ background: 'var(--cream)' }}>
              <h3 className="font-semibold text-gray-900 mb-3">📋 CSV Instructions</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>1. Download the template — it has all products and variants pre-filled</p>
                <p>2. Edit only the <strong>Stock</strong> column for each colour variant</p>
                <p>3. Save as CSV → upload here → check preview → click Apply</p>
                <p className="text-xs text-gray-400 mt-2">✅ Per-variant stock supported &nbsp;|&nbsp; ✅ Partial name match works &nbsp;|&nbsp; ❌ No decimals</p>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Step 1 — Download Template</h3>
              <button onClick={downloadTemplate} className="btn btn-secondary flex items-center gap-2">
                <Download size={16} /> Download CSV Template
              </button>
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Step 2 — Upload Updated CSV</h3>
              <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors hover:border-red-300" style={{ borderColor: '#E5E7EB' }}>
                <Upload size={24} className="text-gray-400 mb-2" />
                <p className="text-sm font-medium text-gray-600">Click to upload CSV</p>
                <p className="text-xs text-gray-400 mt-1">Must have "Product Name", "Colour" and "Stock" columns</p>
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
                        <th className="text-left px-4 py-2 font-semibold text-gray-600">Product</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-600">Colour</th>
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
                            <td className="px-4 py-2 text-gray-500">{row.colour || '—'}</td>
                            <td className="px-4 py-2 text-center font-semibold" style={{ color: 'var(--crimson)' }}>{row.stock}</td>
                            <td className="px-4 py-2 text-center">
                              {match
                                ? <span className="text-green-600 text-xs font-medium">✅ Matched</span>
                                : <span className="text-red-500 text-xs">❌ Not found</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setCsvPreview([])} className="btn btn-secondary flex-1">Clear</button>
                  <button onClick={applyCSV} disabled={saving} className="btn btn-primary flex-1">
                    {saving ? 'Applying...' : 'Apply Updates'}
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
