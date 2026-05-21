'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'

// Pull-to-refresh for mobile admin panel
// Works by tracking touch start/move on the main content area
// Only triggers when already at scroll top (y === 0)
// Threshold: 70px pull = trigger refresh

const THRESHOLD    = 70    // px to pull before releasing triggers refresh
const MAX_PULL     = 100   // max visual pull distance
const RESIST       = 0.45  // resistance factor — feels natural

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [released, setReleased] = useState(false)

  const startYRef    = useRef(0)
  const currentYRef  = useRef(0)
  const pullingRef   = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const triggerRefresh = useCallback(async () => {
    setReleased(true)
    setRefreshing(true)
    setPullDistance(0)

    // Small delay so spinner is visible, then reload
    await new Promise(r => setTimeout(r, 800))
    window.location.reload()
  }, [])

  const onTouchStart = useCallback((e: TouchEvent) => {
    // Only start if scrolled to top
    const el = containerRef.current
    if (!el) return
    const scrollTop = el.scrollTop ?? window.scrollY
    if (scrollTop > 2) return

    startYRef.current  = e.touches[0].clientY
    currentYRef.current = e.touches[0].clientY
    pullingRef.current = false
  }, [])

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (refreshing) return
    currentYRef.current = e.touches[0].clientY
    const delta = currentYRef.current - startYRef.current

    if (delta <= 0) { pullingRef.current = false; setPullDistance(0); return }

    // Check scroll position again — user might have scrolled since touchstart
    const el = containerRef.current
    const scrollTop = el?.scrollTop ?? window.scrollY
    if (scrollTop > 2) { pullingRef.current = false; setPullDistance(0); return }

    pullingRef.current = true
    // Apply resistance — pull feels heavier as it goes further
    const visual = Math.min(MAX_PULL, delta * RESIST)
    setPullDistance(visual)

    // Prevent page scroll while pulling
    if (delta > 5) e.preventDefault()
  }, [refreshing])

  const onTouchEnd = useCallback(() => {
    if (!pullingRef.current) return
    pullingRef.current = false

    if (pullDistance >= THRESHOLD) {
      triggerRefresh()
    } else {
      // Snap back
      setPullDistance(0)
      setReleased(false)
    }
  }, [pullDistance, triggerRefresh])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // passive: false on touchmove so we can call preventDefault
    el.addEventListener('touchstart',  onTouchStart, { passive: true })
    el.addEventListener('touchmove',   onTouchMove,  { passive: false })
    el.addEventListener('touchend',    onTouchEnd,   { passive: true })
    el.addEventListener('touchcancel', onTouchEnd,   { passive: true })

    return () => {
      el.removeEventListener('touchstart',  onTouchStart)
      el.removeEventListener('touchmove',   onTouchMove)
      el.removeEventListener('touchend',    onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [onTouchStart, onTouchMove, onTouchEnd])

  const progress = Math.min(1, pullDistance / THRESHOLD)
  const willRefresh = pullDistance >= THRESHOLD

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 relative">
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 top-0 flex items-center justify-center pointer-events-none z-20 transition-transform"
        style={{
          height: 56,
          transform: `translateY(${pullDistance - 56}px)`,
          transition: released || refreshing ? 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
        }}
      >
        <div className="flex items-center gap-2 px-4 py-2 rounded-full shadow-md"
          style={{ background: willRefresh ? '#8B1A2B' : 'white', border: '1px solid #E5E7EB', transition: 'background 0.2s, border-color 0.2s', borderColor: willRefresh ? '#8B1A2B' : '#E5E7EB' }}>
          <RefreshCw
            size={16}
            style={{
              color: willRefresh ? 'white' : '#6B7280',
              transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
              animation: refreshing ? 'ptr-spin 0.7s linear infinite' : 'none',
              transition: refreshing ? 'none' : 'transform 0.05s linear, color 0.2s',
            }}
          />
          <span className="text-xs font-medium"
            style={{ color: willRefresh ? 'white' : '#6B7280', transition: 'color 0.2s' }}>
            {refreshing ? 'Refreshing…' : willRefresh ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      </div>

      {/* Page content — shifts down with pull */}
      <div style={{
        transform: `translateY(${pullDistance}px)`,
        transition: released || refreshing ? 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
      }}>
        {children}
      </div>

      <style>{`
        @keyframes ptr-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
