'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const CONFIG_GROUPS = [
  { title: 'Brand', keys: [{ key: 'brand_name', label: 'Brand Name' }, { key: 'brand_tagline', label: 'Tagline' }] },
  { title: 'Contact & Support', keys: [{ key: 'whatsapp_number', label: 'WhatsApp Number (with country code)' }, { key: 'support_email', label: 'Support Email' }, { key: 'business_email', label: 'Business Email' }, { key: 'business_address', label: 'Business Address' }, { key: 'gstin', label: 'GSTIN' }] },
  { title: 'Shipping & Returns', keys: [{ key: 'free_shipping_above', label: 'Free Shipping Above (₹)' }, { key: 'default_shipping_charge', label: 'Default Shipping Charge (₹)' }, { key: 'estimated_delivery_days', label: 'Estimated Delivery Days (e.g. 5-7)' }, { key: 'return_window_days', label: 'Return Window (days)' }] },
  { title: 'Payments', keys: [{ key: 'cod_enabled', label: 'COD Enabled (true/false)' }, { key: 'upi_enabled', label: 'UPI Enabled (true/false)' }, { key: 'razorpay_key_id', label: 'Razorpay Key ID' }] },
  { title: 'Integrations', keys: [{ key: 'cloudinary_cloud_name', label: 'Cloudinary Cloud Name' }, { key: 'cloudinary_api_key', label: 'Cloudinary API Key' }, { key: 'fast2sms_key', label: 'Fast2SMS API Key' }, { key: 'shiprocket_email', label: 'Shiprocket Email' }] },
  { title: 'Social Media', keys: [{ key: 'instagram_url', label: 'Instagram URL' }, { key: 'facebook_url', label: 'Facebook URL' }, { key: 'youtube_url', label: 'YouTube URL' }] },
  { title: 'Store Settings', keys: [{ key: 'new_arrivals_days', label: 'New Arrivals Badge (days)' }, { key: 'low_stock_threshold', label: 'Low Stock Alert Threshold' }, { key: 'default_gst_rate', label: 'Default GST Rate (%)' }] },
]

export default function ConfigPage() {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('site_config').select('key,value').then(({ data }) => {
      const c: Record<string, string> = {}
      data?.forEach((r: any) => { c[r.key] = r.value })
      setConfig(c)
    })
  }, [])

  const save = async () => {
    setSaving(true)
    const updates = Object.entries(config).map(([key, value]) => supabase.from('site_config').update({ value, updated_at: new Date().toISOString() }).eq('key', key))
    await Promise.all(updates)
    toast.success('Settings saved! Changes apply to storefront immediately.')
    setSaving(false)
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-2xl font-bold text-gray-900">Site Configuration</h1><p className="text-sm text-gray-500">Changes are reflected on the storefront immediately after saving</p></div>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? 'Saving...' : 'Save All Changes'}</button>
        </div>
        <div className="space-y-6">
          {CONFIG_GROUPS.map(group => (
            <div key={group.title} className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">{group.title}</h2>
              <div className="space-y-3">
                {group.keys.map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">{label}</label>
                    <input className="input" value={config[key] || ''} onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="sticky bottom-6 flex justify-end mt-6">
          <button onClick={save} disabled={saving} className="btn btn-primary shadow-lg">{saving ? 'Saving...' : 'Save All Changes'}</button>
        </div>
      </div>
    </AdminLayout>
  )
}
