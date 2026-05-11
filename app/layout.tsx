import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { createClient } from '@supabase/supabase-js'

// Tab title fix — reads brand name from site_config dynamically
async function getBrandName(): Promise<string> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await supabase
      .from('site_config')
      .select('value')
      .eq('key', 'brand_name')
      .single()
    return data?.value || 'SKSS'
  } catch {
    return 'SKSS'
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const brandName = await getBrandName()
  return {
    title: `${brandName} — Admin Panel`,
    description: `Admin Panel for ${brandName}`,
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
