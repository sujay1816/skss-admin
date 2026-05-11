import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { createClient } from '@supabase/supabase-js'

async function getBrandName(): Promise<string> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await supabase.from('site_config').select('value').eq('key', 'brand_name').single()
    return data?.value || 'SKSS'
  } catch { return 'SKSS' }
}

export async function generateMetadata(): Promise<Metadata> {
  const brandName = await getBrandName()
  return {
    title: `${brandName} — Admin Panel`,
    description: `Admin Panel for ${brandName}`,
    // Fix #23 — viewport meta tag for correct mobile scaling
    viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Fix #23 — explicit viewport tag for mobile browsers */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body>
        {children}
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      </body>
    </html>
  )
}
