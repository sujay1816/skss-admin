'use client'
import { useState, useEffect } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Save, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

const PAGES = [
  { key: 'about', label: 'About Us', type: 'rich', contentKey: 'about_content', titleKey: 'about_title' },
  { key: 'shipping', label: 'Shipping Policy', type: 'rich', contentKey: 'shipping_content', titleKey: 'shipping_title' },
  { key: 'policy', label: 'Return & Refund Policy', type: 'rich', contentKey: 'policy_content', titleKey: 'policy_title' },
  { key: 'privacy', label: 'Privacy Policy', type: 'rich', contentKey: 'privacy_content', titleKey: 'privacy_title' },
  { key: 'terms', label: 'Terms of Service', type: 'rich', contentKey: 'terms_content', titleKey: 'terms_title' },
  { key: 'faq', label: 'FAQ', type: 'faq', contentKey: 'faq_items', titleKey: null },
  { key: 'contact', label: 'Contact Us', type: 'contact', contentKey: null, titleKey: null },
]

const RICH_TOOLBAR = [
  { cmd: 'bold', label: 'B', style: { fontWeight: 'bold' } },
  { cmd: 'italic', label: 'I', style: { fontStyle: 'italic' } },
  { cmd: 'underline', label: 'U', style: { textDecoration: 'underline' } },
  { cmd: 'insertUnorderedList', label: '• List', style: {} },
  { cmd: 'insertOrderedList', label: '1. List', style: {} },
  { cmd: 'formatBlock', value: 'h2', label: 'H2', style: { fontWeight: 'bold' } },
  { cmd: 'formatBlock', value: 'h3', label: 'H3', style: { fontWeight: 'bold' } },
  { cmd: 'formatBlock', value: 'p', label: 'P', style: {} },
]

function RichEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val)
  }

  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border, #E5E7EB)' }}>
      <div className="flex flex-wrap gap-1 p-2 border-b" style={{ borderColor: 'var(--border, #E5E7EB)', background: '#F9FAFB' }}>
        {RICH_TOOLBAR.map(t => (
          <button key={t.cmd + t.label} type="button"
            onMouseDown={e => { e.preventDefault(); exec(t.cmd, t.value) }}
            className="px-2 py-1 text-xs border rounded transition-colors hover:bg-gray-200"
            style={{ borderColor: '#E5E7EB', ...t.style }}>
            {t.label}
          </button>
        ))}
      </div>
      <div
        contentEditable suppressContentEditableWarning
        className="min-h-64 p-4 text-sm outline-none prose-custom"
        style={{ color: '#374151', lineHeight: 1.8 }}
        dangerouslySetInnerHTML={{ __html: value }}
        onInput={e => onChange((e.currentTarget as HTMLDivElement).innerHTML)}
      />
    </div>
  )
}

function FaqEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [items, setItems] = useState<{ q: string; a: string }[]>([])

  useEffect(() => {
    try {
      const parsed = JSON.parse(value || '[]')
      setItems(Array.isArray(parsed) ? parsed : [])
    } catch { setItems([]) }
  }, [])

  const update = (newItems: { q: string; a: string }[]) => {
    setItems(newItems)
    onChange(JSON.stringify(newItems))
  }

  const updateItem = (i: number, field: 'q' | 'a', val: string) => {
    const updated = [...items]
    updated[i] = { ...updated[i], [field]: val }
    update(updated)
  }

  const addItem = () => update([...items, { q: '', a: '' }])
  const removeItem = (i: number) => update(items.filter((_, idx) => idx !== i))
  const moveUp = (i: number) => {
    if (i === 0) return
    const updated = [...items]
    ;[updated[i - 1], updated[i]] = [updated[i], updated[i - 1]]
    update(updated)
  }

  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div key={i} className="border rounded-lg p-4" style={{ borderColor: '#E5E7EB', background: '#FAFAFA' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500">Q&A #{i + 1}</span>
            <div className="flex gap-2">
              {i > 0 && <button type="button" onClick={() => moveUp(i)} className="p-1 text-gray-400 hover:text-gray-600"><ChevronUp size={14} /></button>}
              <button type="button" onClick={() => removeItem(i)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          </div>
          <div className="space-y-2">
            <input className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: '#E5E7EB' }}
              placeholder="Question" value={item.q} onChange={e => updateItem(i, 'q', e.target.value)} />
            <textarea className="w-full border rounded px-3 py-2 text-sm resize-none" style={{ borderColor: '#E5E7EB' }}
              rows={3} placeholder="Answer" value={item.a} onChange={e => updateItem(i, 'a', e.target.value)} />
          </div>
        </div>
      ))}
      <button type="button" onClick={addItem}
        className="flex items-center gap-2 text-sm font-medium px-4 py-2 border rounded-lg transition-colors hover:bg-gray-50"
        style={{ borderColor: '#E5E7EB', color: '#374151' }}>
        <Plus size={16} /> Add Question
      </button>
    </div>
  )
}

function ContactEditor({ config, onSave }: { config: Record<string, string>; onSave: (cfg: Record<string, string>) => void }) {
  const [form, setForm] = useState({
    whatsapp_number: config.whatsapp_number || '',
    support_email: config.support_email || '',
    business_address: config.business_address || '',
    contact_hours: config.contact_hours || 'Mon–Sat: 10:00 AM – 7:00 PM',
    contact_map_url: config.contact_map_url || '',
  })

  return (
    <div className="space-y-4">
      {[
        { key: 'whatsapp_number', label: 'WhatsApp Number', placeholder: '+919876543210' },
        { key: 'support_email', label: 'Support Email', placeholder: 'support@yourdomain.com' },
        { key: 'business_address', label: 'Business Address', placeholder: 'Full address' },
        { key: 'contact_hours', label: 'Business Hours', placeholder: 'Mon–Sat: 10:00 AM – 7:00 PM' },
        { key: 'contact_map_url', label: 'Google Maps URL (optional)', placeholder: 'https://maps.google.com/...' },
      ].map(field => (
        <div key={field.key}>
          <label className="text-xs font-medium text-gray-600 mb-1 block">{field.label}</label>
          <input className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: '#E5E7EB' }}
            placeholder={field.placeholder}
            value={(form as any)[field.key]}
            onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))} />
        </div>
      ))}
      <button type="button" onClick={() => onSave(form)}
        className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg"
        style={{ background: '#8B1A2B' }}>
        <Save size={15} /> Save Contact Info
      </button>
    </div>
  )
}

export default function PagesPage() {
  const [activeTab, setActiveTab] = useState('about')
  const [config, setConfig] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('site_config').select('key, value').then(({ data }) => {
      const cfg: Record<string, string> = {}
      data?.forEach((r: any) => { cfg[r.key] = r.value })
      setConfig(cfg)
      setLoading(false)
    })
  }, [])

  const save = async (key: string, value: string, label: string) => {
    setSaving(true)
    const { error } = await supabase.from('site_config')
      .upsert({ key, value, label }, { onConflict: 'key' })
    if (error) toast.error('Save failed: ' + error.message)
    else { toast.success('Saved!'); setConfig(prev => ({ ...prev, [key]: value })) }
    setSaving(false)
  }

  const saveContact = async (form: Record<string, string>) => {
    setSaving(true)
    for (const [key, value] of Object.entries(form)) {
      await supabase.from('site_config').upsert({ key, value, label: key }, { onConflict: 'key' })
    }
    setConfig(prev => ({ ...prev, ...form }))
    toast.success('Contact info saved!')
    setSaving(false)
  }

  const activePage = PAGES.find(p => p.key === activeTab)!

  return (
    <AdminLayout>
      <div className="max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Page Content</h1>
          <p className="text-sm text-gray-500 mt-0.5">Edit content for all storefront pages</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-6 border-b" style={{ borderColor: '#E5E7EB' }}>
          {PAGES.map(page => (
            <button key={page.key} onClick={() => setActiveTab(page.key)}
              className="px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap"
              style={{ borderBottomColor: activeTab === page.key ? '#8B1A2B' : 'transparent', color: activeTab === page.key ? '#8B1A2B' : '#6B7280' }}>
              {page.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12"><div className="inline-block w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#8B1A2B', borderTopColor: 'transparent' }} /></div>
        ) : (
          <div>
            {/* View on storefront link */}
            <div className="flex items-center justify-between mb-5">
              <a href={`https://skss-storefront.vercel.app/${activePage.key}`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-500 underline">
                View on storefront →
              </a>
            </div>

            {/* Contact page */}
            {activePage.type === 'contact' && (
              <ContactEditor config={config} onSave={saveContact} />
            )}

            {/* FAQ page */}
            {activePage.type === 'faq' && (
              <div>
                <p className="text-xs text-gray-500 mb-4">Add/edit FAQ questions and answers. Drag to reorder.</p>
                <FaqEditor
                  value={config[activePage.contentKey!] || '[]'}
                  onChange={val => setConfig(prev => ({ ...prev, [activePage.contentKey!]: val }))}
                />
                <button onClick={() => save(activePage.contentKey!, config[activePage.contentKey!] || '[]', 'FAQ Items')}
                  disabled={saving}
                  className="mt-5 flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg"
                  style={{ background: '#8B1A2B' }}>
                  <Save size={15} /> {saving ? 'Saving...' : 'Save FAQ'}
                </button>
              </div>
            )}

            {/* Rich text pages */}
            {activePage.type === 'rich' && (
              <div>
                {activePage.titleKey && (
                  <div className="mb-4">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Page Title</label>
                    <input className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: '#E5E7EB' }}
                      placeholder={activePage.label}
                      value={config[activePage.titleKey] || ''}
                      onChange={e => setConfig(prev => ({ ...prev, [activePage.titleKey!]: e.target.value }))} />
                  </div>
                )}
                <label className="text-xs font-medium text-gray-600 mb-2 block">Page Content</label>
                <div className="mb-2 flex flex-wrap gap-1 text-xs text-gray-400">
                  <span>Toolbar: Use buttons above to format text.</span>
                  <span>Select text first, then click Bold/Italic etc.</span>
                </div>
                <RichEditor
                  value={config[activePage.contentKey!] || ''}
                  onChange={val => setConfig(prev => ({ ...prev, [activePage.contentKey!]: val }))}
                />
                <button
                  onClick={async () => {
                    if (activePage.titleKey) {
                      await save(activePage.titleKey, config[activePage.titleKey] || '', activePage.label + ' Title')
                    }
                    await save(activePage.contentKey!, config[activePage.contentKey!] || '', activePage.label + ' Content')
                  }}
                  disabled={saving}
                  className="mt-5 flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg"
                  style={{ background: '#8B1A2B' }}>
                  <Save size={15} /> {saving ? 'Saving...' : `Save ${activePage.label}`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
