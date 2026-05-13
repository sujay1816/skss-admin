'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Search, Edit, Trash2, Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

const PAGE_SIZE = 20

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  // Fix #4 — role check for delete
  const [canDelete, setCanDelete] = useState(false)

  const load = async (p = page, q = search) => {
    setLoading(true)
    // FIX: server-side pagination — only fetch current page from DB
    // Previously fetched ALL products then paginated in JS — slow with 500+ products
    const from = (p - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    let query = supabase.from('products')
      .select('*, categories(name), product_images(url,is_primary), product_variants(stock)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    if (q) query = query.ilike('name', `%${q}%`)
    const { data, count } = await query
    setProducts(data || [])
    setTotalCount(count || 0)
    setLoading(false)
    // Check if current user is manager or superadmin (only once)
    if (p === 1 && !q) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setCanDelete(['admin','manager','superadmin'].includes(profile?.role || ''))
      }
    }
  }

  useEffect(() => { load(1, '') }, [])

  const toggleActive = async (id: string, is_active: boolean) => {
    await supabase.from('products').update({ is_active: !is_active }).eq('id', id)
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: !is_active } : p))
    toast.success(is_active ? 'Product hidden' : 'Product published')
  }

  const deleteProduct = async (id: string) => {
    // Fix #4 — only managers/superadmins can delete
    if (!canDelete) { toast.error('Only admins can delete products'); return }
    if (!confirm('Delete this product? This cannot be undone.')) return
    await supabase.from('products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
    toast.success('Product deleted')
  }

  // Search now triggers a new DB query (not client-side filter)
  // The `load` function already applies .ilike() when search is set
  const filtered = products  // kept for JSX compatibility below

  // Server-side pagination — totalCount comes from DB, products is already the page slice
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const paginated = products  // already fetched as a page slice

  return (
    <AdminLayout>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Products</h1>
            <p className="text-sm text-gray-500">{products.length} total</p>
          </div>
          <Link href="/products/new" className="btn btn-primary"><Plus size={16} /> Add Product</Link>
        </div>

        <div className="card">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9" style={{ height: 36 }} placeholder="Search products..."
                value={search} onChange={e => { const v = e.target.value; setSearch(v); setPage(1); load(1, v) }} />
            </div>
            <p className="text-xs text-gray-400 hidden sm:block">
              {totalCount} results{totalPages > 1 ? ` · Page ${page}/${totalPages}` : ''}
            </p>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {['Product','Category','Price','Stock','Status','Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(p => {
                  const img = p.product_images?.find((i: any) => i.is_primary) || p.product_images?.[0]
                  const totalStock = (p.product_variants || []).reduce((s: number, v: any) => s + v.stock, 0)
                  const effectivePrice = p.sale_price || p.original_price
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-14 border rounded overflow-hidden flex-shrink-0" style={{ background: '#F5EDE3', borderColor: '#E8DDD4' }}>
                            {img?.url ? <Image src={img.url} alt={p.name} width={40} height={56} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg">🥻</div>}
                          </div>
                          <div><p className="font-medium text-gray-900 max-w-xs truncate">{p.name}</p><p className="text-xs text-gray-400">{p.fabric}</p></div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{p.categories?.name || '—'}</td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-gray-900">₹{Number(effectivePrice).toLocaleString('en-IN')}</span>
                        {p.sale_price && <span className="text-xs line-through text-gray-400 ml-1">₹{Number(p.original_price).toLocaleString('en-IN')}</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`badge ${totalStock === 0 ? 'bg-red-100 text-red-700' : totalStock <= 5 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                          {totalStock === 0 ? 'Out of Stock' : `${totalStock} units`}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`badge ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{p.is_active ? 'Published' : 'Hidden'}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/products/${p.id}`} className="p-1.5 rounded hover:bg-gray-100" title="Edit"><Edit size={14} style={{ color: 'var(--crimson)' }} /></Link>
                          <button type="button" onClick={() => toggleActive(p.id, p.is_active)} className="p-1.5 rounded hover:bg-gray-100">
                            {p.is_active ? <EyeOff size={14} className="text-gray-500" /> : <Eye size={14} className="text-gray-500" />}
                          </button>
                          {canDelete && (
                            <button type="button" onClick={() => deleteProduct(p.id)} className="p-1.5 rounded hover:bg-red-50" title="Delete">
                              <Trash2 size={14} className="text-red-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Fix #16 — Mobile card layout */}
          <div className="md:hidden divide-y divide-gray-100">
            {paginated.map(p => {
              const img = p.product_images?.find((i: any) => i.is_primary) || p.product_images?.[0]
              const totalStock = (p.product_variants || []).reduce((s: number, v: any) => s + v.stock, 0)
              return (
                <div key={p.id} className="flex items-center gap-3 p-4">
                  <div className="w-12 h-16 border rounded overflow-hidden flex-shrink-0" style={{ background: '#F5EDE3' }}>
                    {img?.url ? <Image src={img.url} alt={p.name} width={48} height={64} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">🥻</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate text-sm">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.categories?.name} · ₹{Number(p.sale_price || p.original_price).toLocaleString('en-IN')}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge text-xs ${totalStock === 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{totalStock} units</span>
                      <span className={`badge text-xs ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.is_active ? 'Live' : 'Hidden'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Link href={`/products/${p.id}`} className="p-2 rounded bg-gray-100"><Edit size={14} style={{ color: 'var(--crimson)' }} /></Link>
                    <button type="button" onClick={() => toggleActive(p.id, p.is_active)} className="p-2 rounded bg-gray-100">
                      {p.is_active ? <EyeOff size={14} className="text-gray-500" /> : <Eye size={14} className="text-gray-500" />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <p className="text-center py-12 text-sm text-gray-400">{loading ? 'Loading...' : 'No products found'}</p>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 p-4 border-t border-gray-100">
              <button type="button" onClick={() => { const p = Math.max(1, page - 1); setPage(p); load(p, search) }} disabled={page === 1}
                className="p-2 rounded border disabled:opacity-30" style={{ borderColor: '#E5E7EB' }}>
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
              <button type="button" onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); load(p, search) }} disabled={page === totalPages}
                className="p-2 rounded border disabled:opacity-30" style={{ borderColor: '#E5E7EB' }}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
