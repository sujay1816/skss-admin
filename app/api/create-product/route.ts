import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Uses service role key to bypass RLS — same pattern as /api/update-role
// Auth verified via Bearer token, not cookies (more reliable in Next.js API routes)
export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Service role client — bypasses RLS for all operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check role
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    const allowedRoles = ['staff', 'admin', 'manager', 'superadmin']
    if (!profile || !allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden — staff access required' }, { status: 403 })
    }

    const { productData, images, variants } = await request.json()
    if (!productData) return NextResponse.json({ error: 'No product data' }, { status: 400 })

    // Insert product — service role bypasses RLS
    const { data: product, error: productError } = await supabase
      .from('products').insert(productData).select().single()
    if (productError) return NextResponse.json({ error: productError.message }, { status: 500 })

    // Insert images
    if (images?.length) {
      const { error: imgError } = await supabase.from('product_images').insert(
        images.map((img: any, i: number) => ({
          product_id: product.id,
          url: img.url,
          public_id: img.publicId || '',
          is_primary: img.isPrimary,
          order_index: i,
        }))
      )
      if (imgError) console.error('Image insert error:', imgError.message)
    }

    // Insert variants
    if (variants?.length) {
      const { error: varError } = await supabase.from('product_variants').insert(
        variants.map((v: any) => ({ ...v, product_id: product.id }))
      )
      if (varError) console.error('Variant insert error:', varError.message)
    }

    return NextResponse.json({ success: true, productId: product.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
