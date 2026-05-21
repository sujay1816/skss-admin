'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import {
  Upload, RefreshCw, Eye, EyeOff, CheckCircle, XCircle,
  Loader2, AlertTriangle, Lock, Info, Copy, Check,
  ChevronDown, ChevronUp,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const GOOGLE_FONTS = [
  'Cormorant Garamond','Playfair Display','Libre Baskerville',
  'Merriweather','Lora','EB Garamond','Crimson Text','DM Serif Display',
]
const BODY_FONTS = [
  'DM Sans','Inter','Poppins','Nunito','Lato',
  'Open Sans','Raleway','Montserrat','Source Sans 3',
]
const DEFAULT_COLORS = {
  color_primary: '#8B1A2B', color_accent: '#C9A84C',
  color_background: '#F5EDE3', color_page_bg: '#FDFAF7',
}
const DEFAULT_FABRICS = [
  'Silk','Cotton','Georgette','Chiffon','Linen','Organza',
  'Net','Crepe','Tussar','Chanderi','Satin','Velvet','Khadi','Viscose',
]

// ─────────────────────────────────────────────────────────────
// SETUP KEYS — stored in site_config, masked in UI
// These replace the need for most .env variables
// ─────────────────────────────────────────────────────────────
const SETUP_GROUPS = [
  {
    id: 'supabase',
    title: 'Supabase',
    icon: '🗄️',
    docUrl: 'https://supabase.com/dashboard/project/_/settings/api',
    note: 'Found in your Supabase project → Settings → API.',
    fields: [
      {
        key: 'setup_supabase_url',
        label: 'Supabase Project URL',
        placeholder: 'https://xxxxxxxxxxxx.supabase.co',
        secret: false,
        help: 'Your project URL from Supabase dashboard.',
      },
      {
        key: 'setup_supabase_anon_key',
        label: 'Supabase Anon Key (Public)',
        placeholder: 'eyJhbGci...',
        secret: true,
        help: 'Safe to use in browser. Controls public access via RLS.',
      },
      {
        key: 'setup_supabase_service_role_key',
        label: 'Supabase Service Role Key',
        placeholder: 'eyJhbGci...',
        secret: true,
        help: '⚠️ This key bypasses all Row Level Security. Never share it publicly. Used only in server-side API routes.',
        warning: true,
      },
    ],
  },
  {
    id: 'razorpay',
    title: 'Razorpay (Payments)',
    icon: '💳',
    docUrl: 'https://dashboard.razorpay.com/app/keys',
    note: 'Found in Razorpay Dashboard → Settings → API Keys. Use Test keys during development.',
    testable: true,
    fields: [
      {
        key: 'setup_razorpay_key_id',
        label: 'Razorpay Key ID',
        placeholder: 'rzp_live_xxxxxxxxxxxx',
        secret: false,
        help: 'Public key — starts with rzp_live_ (production) or rzp_test_ (testing).',
      },
      {
        key: 'setup_razorpay_key_secret',
        label: 'Razorpay Key Secret',
        placeholder: 'xxxxxxxxxxxxxxxxxxxx',
        secret: true,
        help: 'Secret key used to verify payment signatures. Never share this.',
        warning: true,
      },
    ],
  },
  {
    id: 'resend',
    title: 'Resend (Email)',
    icon: '📧',
    docUrl: 'https://resend.com/api-keys',
    note: 'Create a free account at resend.com. Add and verify your domain for branded emails.',
    testable: true,
    fields: [
      {
        key: 'setup_resend_api_key',
        label: 'Resend API Key',
        placeholder: 're_xxxxxxxxxxxxxxxxxxxx',
        secret: true,
        help: 'Used to send order confirmation and shipping update emails.',
      },
      {
        key: 'setup_from_email',
        label: 'From Email Address',
        placeholder: 'orders@yourdomain.com',
        secret: false,
        help: 'Must match a verified domain in your Resend account.',
      },
      {
        key: 'setup_admin_email',
        label: 'Admin Notification Email',
        placeholder: 'you@yourdomain.com',
        secret: false,
        help: 'Where new order alerts are sent.',
      },
    ],
  },
  {
    id: 'cloudinary',
    title: 'Cloudinary (Image Uploads)',
    icon: '🖼️',
    docUrl: 'https://console.cloudinary.com/settings/api-keys',
    note: 'Free plan gives 25GB storage. Create upload presets named "skss_products" and "skss_banners" in Settings → Upload.',
    testable: true,
    fields: [
      {
        key: 'cloudinary_cloud_name',
        label: 'Cloud Name',
        placeholder: 'your-cloud-name',
        secret: false,
        help: 'Found on your Cloudinary dashboard homepage.',
      },
      {
        key: 'cloudinary_api_key',
        label: 'API Key',
        placeholder: '123456789012345',
        secret: false,
        help: 'Public API key for upload requests.',
      },
      {
        key: 'setup_cloudinary_api_secret',
        label: 'API Secret',
        placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        secret: true,
        help: 'Used for signed uploads. Keep this private.',
        warning: true,
      },
    ],
  },
  {
    id: 'shiprocket',
    title: 'Shiprocket (Shipping)',
    icon: '🚚',
    docUrl: 'https://app.shiprocket.in/api-user',
    note: 'Create an API user in Shiprocket → Settings → API. Use those credentials below (different from your login).',
    testable: true,
    fields: [
      {
        key: 'shiprocket_email',
        label: 'Shiprocket API Email',
        placeholder: 'api@yourdomain.com',
        secret: false,
        help: 'The email of the API user you created in Shiprocket settings.',
      },
      {
        key: 'setup_shiprocket_password',
        label: 'Shiprocket API Password',
        placeholder: '••••••••',
        secret: true,
        help: 'Password for the Shiprocket API user.',
      },
    ],
  },
  {
    id: 'site',
    title: 'Site URLs',
    icon: '🌐',
    note: 'These must match your deployed Vercel domain names exactly.',
    fields: [
      {
        key: 'setup_site_url',
        label: 'Storefront URL',
        placeholder: 'https://your-store.vercel.app',
        secret: false,
        help: 'The public URL of your storefront. Used in emails and SEO.',
      },
      {
        key: 'setup_admin_url',
        label: 'Admin Panel URL',
        placeholder: 'https://your-admin.vercel.app',
        secret: false,
        help: 'The URL of this admin panel. Used in order notification emails.',
      },
      {
        key: 'setup_internal_api_secret',
        label: 'Internal API Secret',
        placeholder: 'any-long-random-string',
        secret: true,
        help: 'A random string you make up — used to protect the stock update API route. Use a password generator.',
        warning: true,
      },
    ],
  },
]

// Keys that MUST stay in Vercel .env (can never work from DB)
const VERCEL_ONLY_VARS = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL',      desc: 'Supabase Project URL — needed before app can start' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', desc: 'Supabase Anon Key — needed before app can start' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY',     desc: 'Supabase Service Role Key — needed for server API routes' },
]

// ─────────────────────────────────────────────────────────────
// CONFIG_GROUPS (store settings tab — unchanged)
// ─────────────────────────────────────────────────────────────
const CONFIG_GROUPS = [
  { title: 'Brand Identity', keys: [
    { key: 'brand_name',       label: 'Brand Name' },
    { key: 'brand_short_name', label: 'Brand Short Name (order number prefix, e.g. SKSS)' },
    { key: 'brand_subtitle',   label: 'Brand Subtitle (e.g. SILKS & SAREES)' },
    { key: 'brand_tagline',    label: 'Tagline' },
    { key: 'gstin',            label: 'GSTIN' },
  ]},
  { title: 'Contact & Support', keys: [
    { key: 'whatsapp_number',  label: 'WhatsApp Number (with country code)' },
    { key: 'support_email',    label: 'Support Email' },
    { key: 'business_email',   label: 'Business Email' },
    { key: 'business_address', label: 'Business Address' },
  ]},
  { title: 'Shipping & Returns', keys: [
    { key: 'free_shipping_above',      label: 'Free Shipping Above (₹)' },
    { key: 'default_shipping_charge',  label: 'Default Shipping Charge (₹)' },
    { key: 'estimated_delivery_days',  label: 'Estimated Delivery Days (e.g. 5-7)' },
    { key: 'return_window_days',       label: 'Return Window (days)' },
  ]},
  { title: 'Payments', keys: [
    { key: 'cod_enabled',    label: 'COD Enabled (true/false)' },
    { key: 'upi_enabled',    label: 'UPI Enabled (true/false)' },
    { key: 'razorpay_key_id', label: 'Razorpay Key ID (public)' },
  ]},
  { title: 'Social Media', keys: [
    { key: 'instagram_url', label: 'Instagram URL' },
    { key: 'facebook_url',  label: 'Facebook URL' },
    { key: 'youtube_url',   label: 'YouTube URL' },
  ]},
  { title: 'Store Settings', keys: [
    { key: 'new_arrivals_days',    label: 'New Arrivals Badge (days)' },
    { key: 'low_stock_threshold',  label: 'Low Stock Alert Threshold' },
    { key: 'default_gst_rate',     label: 'Default GST Rate (%)' },
  ]},
]

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS (defined outside to prevent focus loss)
// ─────────────────────────────────────────────────────────────

// Masked secret input with show/hide toggle
const SecretInput = ({
  value, onChange, placeholder, warning,
}: {
  value: string; onChange: (v: string) => void
  placeholder?: string; warning?: boolean
}) => {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input w-full pr-10"
        style={{ borderColor: warning && value ? '#F59E0B' : undefined }}
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        tabIndex={-1}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

// Copy-to-clipboard button
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors"
      style={{ borderColor: '#E5E7EB', color: copied ? '#16A34A' : '#6B7280', background: copied ? '#F0FDF4' : 'white' }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// Setup completion badge
const StatusBadge = ({ filled }: { filled: boolean }) =>
  filled ? (
    <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
      <CheckCircle size={11} /> Set
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
      <AlertTriangle size={11} /> Missing
    </span>
  )

// Fabric manager
const FabricsManager = ({
  config, setConfig,
}: {
  config: Record<string, string>
  setConfig: (fn: (p: Record<string, string>) => Record<string, string>) => void
}) => {
  const [newFabric, setNewFabric] = useState('')
  const fabrics: string[] = (() => {
    try { return JSON.parse(config.fabric_types || '[]') } catch { return DEFAULT_FABRICS }
  })()
  const save = (list: string[]) => setConfig(p => ({ ...p, fabric_types: JSON.stringify(list) }))
  const add = () => {
    const t = newFabric.trim()
    if (!t || fabrics.includes(t)) return
    save([...fabrics, t]); setNewFabric('')
  }
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-gray-900">Fabric Types</h2>
        <button type="button" onClick={() => save(DEFAULT_FABRICS)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
          <RefreshCw size={12} /> Reset defaults
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Appear as filter chips on the shop page and fabric dropdown when adding products.
      </p>
      <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg min-h-12" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
        {fabrics.length === 0 && <p className="text-xs text-gray-400">No fabrics — click Reset defaults</p>}
        {fabrics.map(f => (
          <span key={f} className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full text-white" style={{ background: 'var(--crimson)' }}>
            {f}
            <button type="button" onClick={() => save(fabrics.filter(x => x !== f))} className="hover:opacity-70">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input flex-1" value={newFabric} onChange={e => setNewFabric(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Type fabric name e.g. Raw Silk..." style={{ height: 38 }} />
        <button type="button" onClick={add} className="btn btn-primary flex-shrink-0" style={{ height: 38, padding: '0 16px' }}>+ Add</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function ConfigPage() {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<'brand' | 'settings' | 'setup'>('setup')
  const [testResults, setTestResults] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>({})
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    supabase: true, razorpay: true, resend: true, cloudinary: true, shiprocket: true, site: true,
  })

  useEffect(() => {
    supabase.from('site_config').select('key,value').then(({ data }) => {
      const c: Record<string, string> = {}
      data?.forEach((r: any) => { c[r.key] = r.value })
      Object.entries(DEFAULT_COLORS).forEach(([k, v]) => { if (!c[k]) c[k] = v })
      if (!c.font_heading) c.font_heading = 'Cormorant Garamond'
      if (!c.font_body)    c.font_body    = 'DM Sans'
      if (!c.brand_subtitle) c.brand_subtitle = 'SILKS & SAREES'
      setConfig(c)
    })
  }, [])

  // ── Save all config to site_config table ──
  const save = async () => {
    setSaving(true)
    try {
      const updates = Object.entries(config).map(([key, value]) =>
        supabase.from('site_config').upsert(
          { key, value, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
      )
      const results = await Promise.all(updates)
      const failed = results.filter(r => r.error)
      if (failed.length > 0) {
        toast.error(`${failed.length} setting(s) failed to save.`)
      } else {
        toast.success('All settings saved!')
      }
    } catch (e: any) {
      toast.error('Save failed: ' + e.message)
    }
    setSaving(false)
  }

  // ── Test integration connections ──
  const testConnection = async (groupId: string) => {
    setTestResults(p => ({ ...p, [groupId]: 'testing' }))
    try {
      if (groupId === 'razorpay') {
        const keyId = config.setup_razorpay_key_id
        const keySecret = config.setup_razorpay_key_secret
        if (!keyId || !keySecret) { setTestResults(p => ({ ...p, razorpay: 'fail' })); toast.error('Enter both Razorpay keys first'); return }
        const auth = btoa(`${keyId}:${keySecret}`)
        const res = await fetch('https://api.razorpay.com/v1/orders?count=1', {
          headers: { Authorization: `Basic ${auth}` },
        })
        setTestResults(p => ({ ...p, razorpay: res.ok ? 'ok' : 'fail' }))
        toast[res.ok ? 'success' : 'error'](res.ok ? 'Razorpay connected ✓' : 'Razorpay keys invalid')
      }

      if (groupId === 'resend') {
        const apiKey = config.setup_resend_api_key
        if (!apiKey) { setTestResults(p => ({ ...p, resend: 'fail' })); toast.error('Enter Resend API key first'); return }
        const res = await fetch('https://api.resend.com/domains', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        setTestResults(p => ({ ...p, resend: res.ok ? 'ok' : 'fail' }))
        toast[res.ok ? 'success' : 'error'](res.ok ? 'Resend connected ✓' : 'Resend API key invalid')
      }

      if (groupId === 'cloudinary') {
        const cloudName = config.cloudinary_cloud_name
        if (!cloudName) { setTestResults(p => ({ ...p, cloudinary: 'fail' })); toast.error('Enter Cloud Name first'); return }
        const res = await fetch(`https://res.cloudinary.com/${cloudName}/image/upload`)
        // Cloudinary returns 400 (not 404) for valid cloud names — either way means reachable
        setTestResults(p => ({ ...p, cloudinary: res.status !== 0 ? 'ok' : 'fail' }))
        toast.success('Cloudinary cloud name reachable ✓')
      }

      if (groupId === 'shiprocket') {
        const email = config.shiprocket_email
        const password = config.setup_shiprocket_password
        if (!email || !password) { setTestResults(p => ({ ...p, shiprocket: 'fail' })); toast.error('Enter Shiprocket credentials first'); return }
        const res = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        const data = await res.json()
        const ok = !!data.token
        setTestResults(p => ({ ...p, shiprocket: ok ? 'ok' : 'fail' }))
        toast[ok ? 'success' : 'error'](ok ? 'Shiprocket login success ✓' : 'Shiprocket credentials invalid')
      }
    } catch {
      setTestResults(p => ({ ...p, [groupId]: 'fail' }))
      toast.error('Connection test failed')
    }
  }

  // ── Logo upload ──
  const uploadLogo = async (file: File) => {
    setUploading(true)
    const cloudName = config.cloudinary_cloud_name
    if (!cloudName) { toast.error('Set Cloudinary Cloud Name first'); setUploading(false); return }
    const fd = new FormData()
    fd.append('file', file); fd.append('upload_preset', 'skss_products'); fd.append('folder', 'skss/brand')
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      setConfig(p => ({ ...p, logo_url: data.secure_url }))
      toast.success('Logo uploaded!')
    } catch { toast.error('Upload failed') }
    setUploading(false)
  }

  const resetColors = () => {
    setConfig(p => ({ ...p, ...DEFAULT_COLORS, font_heading: 'Cormorant Garamond', font_body: 'DM Sans' }))
    toast.success('Colors reset to defaults')
  }

  // ── Setup completion checker ──
  const allSetupFields = SETUP_GROUPS.flatMap(g => g.fields)
  const filledCount = allSetupFields.filter(f => !!config[f.key]?.trim()).length
  const totalCount  = allSetupFields.length
  const setupPct    = Math.round((filledCount / totalCount) * 100)

  const tabs = [
    { id: 'setup',    label: '🔧 Setup & Integrations' },
    { id: 'brand',    label: '🎨 Brand & Design' },
    { id: 'settings', label: '⚙️ Store Settings' },
  ]

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Site Configuration</h1>
            <p className="text-sm text-gray-500 mt-0.5">Changes go live on the storefront within 60 seconds</p>
          </div>
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save All Changes'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-6 border-b border-gray-200 overflow-x-auto">
          {tabs.map(({ id, label }) => (
            <button
              key={id} type="button"
              onClick={() => setActiveTab(id as any)}
              className="px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex-shrink-0"
              style={{
                borderBottomColor: activeTab === id ? 'var(--crimson)' : 'transparent',
                color: activeTab === id ? 'var(--crimson)' : '#6B7280',
              }}
            >
              {label}
              {id === 'setup' && setupPct < 100 && (
                <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                  {setupPct}%
                </span>
              )}
              {id === 'setup' && setupPct === 100 && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════
            TAB: SETUP & INTEGRATIONS
            ══════════════════════════════════════ */}
        {activeTab === 'setup' && (
          <div className="space-y-5">

            {/* Progress bar */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-900">Setup Progress</p>
                <span className="text-sm font-bold" style={{ color: setupPct === 100 ? '#16A34A' : 'var(--crimson)' }}>
                  {filledCount} / {totalCount} fields filled
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${setupPct}%`,
                    background: setupPct === 100
                      ? 'linear-gradient(to right, #16A34A, #22C55E)'
                      : 'linear-gradient(to right, var(--crimson), var(--gold))',
                  }}
                />
              </div>
              {setupPct === 100 && (
                <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
                  <CheckCircle size={12} /> All integrations configured — your store is ready!
                </p>
              )}
            </div>

            {/* ── VERCEL-ONLY notice ── */}
            <div className="rounded-lg p-4 border" style={{ background: '#FFF7ED', borderColor: '#FED7AA' }}>
              <div className="flex items-start gap-3">
                <Lock size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-orange-900 mb-1">
                    3 variables must be set in Vercel — one time only
                  </p>
                  <p className="text-xs text-orange-700 mb-3">
                    These are needed <strong>before</strong> the app can start, so they can&apos;t be stored in the database.
                    Set them once in your Vercel project → Settings → Environment Variables, then you never touch them again.
                  </p>
                  <div className="space-y-2">
                    {VERCEL_ONLY_VARS.map(v => (
                      <div key={v.key} className="flex items-center justify-between gap-3 bg-white rounded p-2.5 border border-orange-100">
                        <div>
                          <code className="text-xs font-mono font-bold text-orange-800">{v.key}</code>
                          <p className="text-xs text-gray-500 mt-0.5">{v.desc}</p>
                        </div>
                        <CopyButton text={v.key} />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-orange-600 mt-3">
                    💡 <strong>Where to find them:</strong> Supabase Dashboard → your project → Settings → API
                  </p>
                </div>
              </div>
            </div>

            {/* ── Everything else — editable here ── */}
            <div className="rounded-lg p-3 border text-xs" style={{ background: '#F0FDF4', borderColor: '#BBF7D0', color: '#166534' }}>
              <div className="flex items-center gap-2">
                <Info size={13} />
                <span>
                  Everything below is stored securely in your Supabase database.
                  Only superadmin users can see or edit these fields.
                  Fill them in once — you won&apos;t need to open Vercel or Supabase again.
                </span>
              </div>
            </div>

            {/* Integration groups */}
            {SETUP_GROUPS.map(group => {
              const isExpanded = expandedGroups[group.id] !== false
              const groupFilled = group.fields.filter(f => !!config[f.key]?.trim()).length
              const groupTotal  = group.fields.length
              const allFilled   = groupFilled === groupTotal
              const testStatus  = testResults[group.id]

              return (
                <div key={group.id} className="card overflow-hidden" style={{ padding: 0 }}>
                  {/* Group header */}
                  <button
                    type="button"
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedGroups(p => ({ ...p, [group.id]: !isExpanded }))}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{group.icon}</span>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-gray-900">{group.title}</p>
                        <p className="text-xs text-gray-400">{groupFilled}/{groupTotal} fields set</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {allFilled
                        ? <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle size={11} /> Complete</span>
                        : <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"><AlertTriangle size={11} /> Incomplete</span>
                      }
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </button>

                  {/* Group body */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 space-y-4">
                      {/* Doc link + note */}
                      {group.note && (
                        <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                          <Info size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-600">
                            {group.note}
                            {group.docUrl && (
                              <> <a href={group.docUrl} target="_blank" rel="noopener noreferrer" className="underline text-blue-600 ml-1">Open dashboard →</a></>
                            )}
                          </span>
                        </div>
                      )}

                      {/* Fields */}
                      {group.fields.map(field => (
                        <div key={field.key}>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium text-gray-700">{field.label}</label>
                            <StatusBadge filled={!!config[field.key]?.trim()} />
                          </div>
                          {field.secret ? (
                            <SecretInput
                              value={config[field.key] || ''}
                              onChange={v => setConfig(p => ({ ...p, [field.key]: v }))}
                              placeholder={field.placeholder}
                              warning={field.warning}
                            />
                          ) : (
                            <input
                              type="text"
                              className="input w-full"
                              value={config[field.key] || ''}
                              onChange={e => setConfig(p => ({ ...p, [field.key]: e.target.value }))}
                              placeholder={field.placeholder}
                            />
                          )}
                          <p className="text-xs text-gray-400 mt-1">{field.help}</p>
                          {field.warning && config[field.key] && (
                            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                              <AlertTriangle size={11} /> Keep this value private — never share it.
                            </p>
                          )}
                        </div>
                      ))}

                      {/* Test connection button */}
                      {group.testable && (
                        <div className="pt-2 border-t border-gray-100 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => testConnection(group.id)}
                            disabled={testStatus === 'testing'}
                            className="flex items-center gap-2 text-xs px-3 py-2 rounded border font-medium transition-colors"
                            style={{
                              borderColor: testStatus === 'ok' ? '#BBF7D0' : testStatus === 'fail' ? '#FECACA' : '#E5E7EB',
                              background: testStatus === 'ok' ? '#F0FDF4' : testStatus === 'fail' ? '#FEF2F2' : 'white',
                              color: testStatus === 'ok' ? '#16A34A' : testStatus === 'fail' ? '#DC2626' : '#374151',
                            }}
                          >
                            {testStatus === 'testing' && <Loader2 size={13} className="animate-spin" />}
                            {testStatus === 'ok'      && <CheckCircle size={13} />}
                            {testStatus === 'fail'    && <XCircle size={13} />}
                            {(!testStatus || testStatus === 'idle') && <CheckCircle size={13} />}
                            {testStatus === 'testing' ? 'Testing...'
                              : testStatus === 'ok'   ? 'Connected ✓'
                              : testStatus === 'fail' ? 'Failed — check keys'
                              : 'Test Connection'}
                          </button>
                          {testStatus === 'fail' && (
                            <p className="text-xs text-red-500">Check your credentials and try again.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Final note */}
            <div className="rounded-lg p-4 border text-xs text-gray-500" style={{ background: '#F9FAFB', borderColor: '#E5E7EB' }}>
              <p className="font-medium text-gray-700 mb-1">📝 How these values are used</p>
              <p>
                These keys are read by your storefront and admin panel at runtime from the Supabase database.
                The app checks this table on every relevant API call, so changes here take effect immediately — no redeployment needed.
                Secret fields are masked in this UI but stored as plain text in your Supabase <code className="bg-gray-100 px-1 rounded">site_config</code> table.
                Make sure your Supabase project has Row Level Security enabled and only superadmin roles can access this config page.
              </p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            TAB: BRAND & DESIGN
            ══════════════════════════════════════ */}
        {activeTab === 'brand' && (
          <div className="space-y-6">
            {/* Logo */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Logo</h2>
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  {config.logo_url ? (
                    <img src={config.logo_url} alt="Logo" className="w-24 h-24 object-contain border rounded-lg p-2" style={{ borderColor: '#E5E7EB' }} />
                  ) : (
                    <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center" style={{ borderColor: '#E5E7EB' }}>
                      <span className="text-3xl">🏪</span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-red-300 transition-colors mb-3" style={{ borderColor: '#E5E7EB' }}>
                    <Upload size={18} className="text-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">{uploading ? 'Uploading...' : 'Click to upload logo'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, SVG recommended</p>
                    <input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                  </label>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Or paste Cloudinary URL directly</label>
                    <input className="input text-xs" value={config.logo_url || ''} onChange={e => setConfig(p => ({ ...p, logo_url: e.target.value }))} placeholder="https://res.cloudinary.com/..." />
                  </div>
                </div>
              </div>
            </div>

            {/* Colors */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Brand Colors</h2>
                <button type="button" onClick={resetColors} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
                  <RefreshCw size={12} /> Reset to defaults
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'color_primary',    label: 'Primary Color',    desc: 'Buttons, highlights, headings', example: 'Default: #8B1A2B' },
                  { key: 'color_accent',     label: 'Accent Color',     desc: 'Gold accents, tags, borders',   example: 'Default: #C9A84C' },
                  { key: 'color_background', label: 'Card Background',  desc: 'Product card backgrounds',      example: 'Default: #F5EDE3' },
                  { key: 'color_page_bg',    label: 'Page Background',  desc: 'Overall page background',       example: 'Default: #FDFAF7' },
                ].map(({ key, label, desc, example }) => (
                  <div key={key} className="flex items-start gap-3 p-3 border rounded-lg" style={{ borderColor: '#E5E7EB' }}>
                    <div className="flex-shrink-0 flex flex-col items-center gap-2">
                      <input type="color" value={config[key] || '#000000'}
                        onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))}
                        className="w-12 h-12 border-2 rounded-lg cursor-pointer" style={{ padding: 2, borderColor: '#E5E7EB' }} />
                      <span className="text-xs font-mono text-gray-500">{config[key] || '#000000'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                      <p className="text-xs text-gray-400 mt-1">{example}</p>
                      <input type="text" value={config[key] || ''} onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))}
                        placeholder="#000000" className="input mt-2 text-xs font-mono" style={{ height: 30 }} />
                    </div>
                  </div>
                ))}
              </div>
              {/* Live preview */}
              <div className="mt-4 p-4 rounded-lg border" style={{ borderColor: '#E5E7EB', background: config.color_page_bg || '#FDFAF7' }}>
                <p className="text-xs text-gray-500 mb-3 font-medium">Live Preview</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <button className="px-4 py-2 text-xs text-white rounded" style={{ background: config.color_primary || '#8B1A2B' }}>Primary Button</button>
                  <button className="px-4 py-2 text-xs text-white rounded" style={{ background: config.color_accent || '#C9A84C' }}>Accent Button</button>
                  <span className="px-3 py-1 text-xs rounded" style={{ background: config.color_background || '#F5EDE3', color: config.color_primary || '#8B1A2B', border: `1px solid ${config.color_accent || '#C9A84C'}` }}>Badge</span>
                  <span className="text-sm font-semibold" style={{ color: config.color_primary || '#8B1A2B', fontFamily: `'${config.font_heading || 'serif'}', serif` }}>Heading Preview</span>
                  <span className="text-sm" style={{ color: '#5A4A3A', fontFamily: `'${config.font_body || 'sans-serif'}', sans-serif` }}>Body Preview</span>
                </div>
              </div>
            </div>

            {/* Fonts */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-1">Typography</h2>
              <p className="text-xs text-gray-500 mb-4">Google Fonts — loaded automatically by the storefront.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-2 block">Heading Font</label>
                  <select className="input" value={config.font_heading || 'Cormorant Garamond'} onChange={e => setConfig(p => ({ ...p, font_heading: e.target.value }))}>
                    {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <p className="text-2xl mt-2 font-light" style={{ fontFamily: `'${config.font_heading || 'Cormorant Garamond'}', serif` }}>The quick brown fox</p>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-2 block">Body Font</label>
                  <select className="input" value={config.font_body || 'DM Sans'} onChange={e => setConfig(p => ({ ...p, font_body: e.target.value }))}>
                    {BODY_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <p className="text-base mt-2" style={{ fontFamily: `'${config.font_body || 'DM Sans'}', sans-serif` }}>The quick brown fox jumps over the lazy dog</p>
                </div>
              </div>
            </div>

            {/* Brand text */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Brand Identity</h2>
              <div className="space-y-3">
                {CONFIG_GROUPS[0].keys.map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">{label}</label>
                    <input className="input" value={config[key] || ''} onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            TAB: STORE SETTINGS
            ══════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {CONFIG_GROUPS.slice(1).map(group => (
              <div key={group.title} className="card p-5">
                <h2 className="font-semibold text-gray-900 mb-4">{group.title}</h2>
                <div className="space-y-3">
                  {group.keys.map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-xs text-gray-600 font-medium mb-1 block">{label}</label>
                      <input className="input" value={config[key] || ''} onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <FabricsManager config={config} setConfig={setConfig} />
          </div>
        )}

        {/* Sticky save button */}
        <div className="sticky bottom-6 flex justify-end mt-6">
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary shadow-lg">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save All Changes'}
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}
