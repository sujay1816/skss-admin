'use client'
// QA FIX — CPN (coupons), NTFY, PROD, RETURNS: Replace window.confirm() with a
// proper modal that works on mobile, doesn't block the browser thread, and gives
// a professional UX. All confirm() calls across the admin panel should use this.
//
// Usage:
//   const { confirm, ConfirmModal } = useConfirm()
//   ...
//   const ok = await confirm({ title: 'Delete product?', message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true })
//   if (!ok) return
//   ... proceed with action

import { useState, useCallback, useRef } from 'react'
import { AlertTriangle, Info } from 'lucide-react'

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean   // true = red confirm button; false = primary button
}

// Resolve function stored between render cycles via ref
type ResolveFn = (value: boolean) => void

export function useConfirm() {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<ConfirmOptions>({ title: '', message: '' })
  const resolveRef = useRef<ResolveFn | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setOpts(options)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const handleConfirm = useCallback(() => {
    setOpen(false)
    resolveRef.current?.(true)
    resolveRef.current = null
  }, [])

  const handleCancel = useCallback(() => {
    setOpen(false)
    resolveRef.current?.(false)
    resolveRef.current = null
  }, [])

  const ConfirmModal = open ? (
    // Backdrop — click outside to cancel
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon + Title */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${opts.danger ? 'bg-red-50' : 'bg-blue-50'}`}>
            {opts.danger
              ? <AlertTriangle size={20} className="text-red-500" />
              : <Info size={20} className="text-blue-500" />
            }
          </div>
          <div>
            <h3 id="confirm-title" className="font-semibold text-gray-900 text-base">{opts.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{opts.message}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-5 justify-end">
          <button
            type="button"
            onClick={handleCancel}
            className="btn btn-secondary"
            autoFocus
          >
            {opts.cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={opts.danger ? 'btn' : 'btn btn-primary'}
            style={opts.danger ? { background: '#DC2626', color: 'white' } : undefined}
          >
            {opts.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, ConfirmModal }
}
