'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { Star, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'approved'>('pending')

  useEffect(() => { load() }, [tab])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('reviews')
      .select('*, profiles(full_name, email), products(name, slug)')
      .eq('is_approved', tab === 'approved')
      .order('created_at', { ascending: false })
    setReviews(data || [])
    setLoading(false)
  }

  const approve = async (id: string) => {
    await supabase.from('reviews').update({ is_approved: true }).eq('id', id)
    setReviews(prev => prev.filter(r => r.id !== id))
    toast.success('Review approved — now visible on storefront')
  }

  const reject = async (id: string) => {
    if (!confirm('Delete this review permanently?')) return
    await supabase.from('reviews').delete().eq('id', id)
    setReviews(prev => prev.filter(r => r.id !== id))
    toast.success('Review deleted')
  }

  const Stars = ({ rating }: { rating: number }) => (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={14} fill={i < rating ? '#C9A84C' : 'none'}
          stroke={i < rating ? '#C9A84C' : '#D1D5DB'} />
      ))}
    </div>
  )

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
            <p className="text-sm text-gray-500 mt-0.5">Moderate customer reviews before they go live</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {(['pending', 'approved'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2 text-sm font-medium capitalize transition-colors"
              style={{
                color: tab === t ? 'var(--crimson)' : '#6B7280',
                borderBottom: tab === t ? '2px solid var(--crimson)' : '2px solid transparent',
                marginBottom: -1,
              }}>
              {t === 'pending' ? 'Pending Approval' : 'Approved'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-10">Loading...</p>
        ) : reviews.length === 0 ? (
          <div className="card p-10 text-center text-sm text-gray-400">
            {tab === 'pending' ? 'No reviews pending approval' : 'No approved reviews yet'}
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map(r => (
              <div key={r.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Product */}
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1"
                      style={{ color: 'var(--crimson)' }}>
                      {r.products?.name || 'Unknown Product'}
                    </p>
                    {/* Customer */}
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm font-medium text-gray-900">
                        {r.profiles?.full_name || 'Anonymous'}
                      </p>
                      <p className="text-xs text-gray-400">{r.profiles?.email}</p>
                    </div>
                    {/* Rating */}
                    <Stars rating={r.rating} />
                    {/* Comment */}
                    <p className="text-sm text-gray-700 mt-2 leading-relaxed">{r.comment}</p>
                    {/* Date */}
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(r.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    {tab === 'pending' && (
                      <button onClick={() => approve(r.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded"
                        style={{ background: '#16A34A' }}>
                        <Check size={13} /> Approve
                      </button>
                    )}
                    <button onClick={() => reject(r.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded"
                      style={{ background: '#DC2626' }}>
                      <X size={13} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
