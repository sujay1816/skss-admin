'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Upload, RefreshCw } from 'lucide-react'

const GOOGLE_FONTS = ['Cormorant Garamond','Playfair Display','Libre Baskerville','Merriweather','Lora','EB Garamond','Crimson Text','DM Serif Display']
const BODY_FONTS = ['DM Sans','Inter','Poppins','Nunito','Lato','Open Sans','Raleway','Montserrat','Source Sans 3']

const CONFIG_GROUPS = [
  { title: 'Brand Identity', keys: [
    { key: 'brand_name', label: 'Brand Name' },
    { key: 'brand_subtitle', label: 'Brand Subtitle (shown under logo e.g. SILKS & SAREES)' },
    { key: 'brand_tagline', label: 'Tagline' },
    { key: 'gstin', label: 'GSTIN' },
  ]},
  { title: 'Contact & Support', keys: [
    { key: 'whatsapp_number', label: 'WhatsApp Number (with country code)' },
    { key: 'support_email', label: 'Support Email' },
    { key: 'business_email', label: 'Business Email' },
    { key: 'business_address', label: 'Business Address' },
  ]},
  { title: 'Shipping & Returns', keys: [
    { key: 'free_shipping_above', label: 'Free Shipping Above (₹)' },
    { key: 'default_shipping_charge', label: 'Default Shipping Charge (₹)' },
    { key: 'estimated_delivery_days', label: 'Estimated Delivery Days (e.g. 5-7)' },
    { key: 'return_window_days', label: 'Return Window (days)' },
  ]},
  { title: 'Payments', keys: [
    { key: 'cod_enabled', label: 'COD Enabled (true/false)' },
    { key: 'upi_enabled', label: 'UPI Enabled (true/false)' },
    { key: 'razorpay_key_id', label: 'Razorpay Key ID' },
  ]},
  { title: 'Integrations', keys: [
    { key: 'cloudinary_cloud_name', label: 'Cloudinary Cloud Name' },
    { key: 'cloudinary_api_key', label: 'Cloudinary API Key' },
    { key: 'fast2sms_key', label: 'Fast2SMS API Key' },
    { key: 'shiprocket_email', label: 'Shiprocket Email' },
  ]},
  { title: 'Social Media', keys: [
    { key: 'instagram_url', label: 'Instagram URL' },
    { key: 'facebook_url', label: 'Facebook URL' },
    { key: 'youtube_url', label: 'YouTube URL' },
  ]},
  { title: 'Store Settings', keys: [
    { key: 'new_arrivals_days', label: 'New Arrivals Badge (days)' },
    { key: 'low_stock_threshold', label: 'Low Stock Alert Threshold' },
    { key: 'default_gst_rate', label: 'Default GST Rate (%)' },
  ]},
]

const DEFAULT_COLORS = {
  color_primary: '#8B1A2B',
  color_accent: '#C9A84C',
  color_background: '#F5EDE3',
  color_page_bg: '#FDFAF7',
}

export default function ConfigPage() {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<'brand' | 'settings'>('brand')
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    supabase.from('site_config').select('key,value').then(({ data }) => {
      const c: Record<string, string> = {}
      data?.forEach((r: any) => { c[r.key] = r.value })
      // Set defaults for brand colors if not set
      Object.entries(DEFAULT_COLORS).forEach(([k, v]) => { if (!c[k]) c[k] = v })
      if (!c.font_heading) c.font_heading = 'Cormorant Garamond'
      if (!c.font_body) c.font_body = 'DM Sans'
      if (!c.brand_subtitle) c.brand_subtitle = 'SILKS & SAREES'
      setConfig(c)
    })
  }, [])

  const save = async () => {
    setSaving(true)
    const updates = Object.entries(config).map(([key, value]) =>
      supabase.from('site_config').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    )
    await Promise.all(updates)
    toast.success('Settings saved! Changes will appear on storefront within a minute.')
    setSaving(false)
  }

  const uploadLogo = async (file: File) => {
    setUploading(true)
    const cloudName = config.cloudinary_cloud_name
    if (!cloudName) { toast.error('Please set Cloudinary Cloud Name first'); setUploading(false); return }
    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', 'skss_products')
    fd.append('folder', 'skss/brand')
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

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Site Configuration</h1>
            <p className="text-sm text-gray-500 mt-0.5">Changes appear on storefront immediately after saving</p>
          </div>
          <button onClick={save} disabled={saving} className="btn btn-primary">
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-6 border-b border-gray-200">
          {[['brand', '🎨 Brand & Design'], ['settings', '⚙️ Store Settings']].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)}
              className="px-5 py-3 text-sm font-medium border-b-2 transition-all"
              style={{ borderBottomColor: activeTab === tab ? 'var(--crimson)' : 'transparent', color: activeTab === tab ? 'var(--crimson)' : '#6B7280' }}>
              {label}
            </button>
          ))}
        </div>

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
                <button onClick={resetColors} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
                  <RefreshCw size={12} /> Reset to defaults
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'color_primary', label: 'Primary Color', desc: 'Main brand color — buttons, highlights, headings', example: 'Default: Crimson #8B1A2B' },
                  { key: 'color_accent', label: 'Accent Color', desc: 'Secondary color — gold accents, tags, borders', example: 'Default: Gold #C9A84C' },
                  { key: 'color_background', label: 'Card Background', desc: 'Product card and section backgrounds', example: 'Default: Cream #F5EDE3' },
                  { key: 'color_page_bg', label: 'Page Background', desc: 'Overall page background color', example: 'Default: Ivory #FDFAF7' },
                ].map(({ key, label, desc, example }) => (
                  <div key={key} className="flex items-start gap-3 p-3 border rounded-lg" style={{ borderColor: '#E5E7EB' }}>
                    <div className="flex-shrink-0 flex flex-col items-center gap-2">
                      <input type="color" value={config[key] || '#000000'}
                        onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))}
                        className="w-12 h-12 border-2 rounded-lg cursor-pointer"
                        style={{ padding: 2, borderColor: '#E5E7EB' }} />
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
                  <span className="text-sm font-semibold" style={{ color: config.color_primary || '#8B1A2B', fontFamily: `'${config.font_heading || 'serif'}', serif` }}>Heading Font Preview</span>
                  <span className="text-sm" style={{ color: '#5A4A3A', fontFamily: `'${config.font_body || 'sans-serif'}', sans-serif` }}>Body Font Preview</span>
                </div>
              </div>
            </div>

            {/* Fonts */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-1">Typography</h2>
              <p className="text-xs text-gray-500 mb-4">These are Google Fonts. The storefront will load them automatically.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-2 block">Heading Font</label>
                  <p className="text-xs text-gray-400 mb-2">Used for product names, section titles, hero text</p>
                  <select className="input" value={config.font_heading || 'Cormorant Garamond'} onChange={e => setConfig(p => ({ ...p, font_heading: e.target.value }))}>
                    {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <p className="text-2xl mt-2 font-light" style={{ fontFamily: `'${config.font_heading || 'Cormorant Garamond'}', serif` }}>The quick brown fox</p>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-2 block">Body Font</label>
                  <p className="text-xs text-gray-400 mb-2">Used for descriptions, buttons, navigation, prices</p>
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
          </div>
        )}

        <div className="sticky bottom-6 flex justify-end mt-6">
          <button onClick={save} disabled={saving} className="btn btn-primary shadow-lg">
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}
