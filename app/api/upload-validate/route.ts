import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// QA FIX — FILE-019, FILE-020, SEC-012, SEC-013
// Centralised upload validation endpoint.
// Validates file type, size, and filename before allowing upload to Cloudinary.
//
// Previously: the admin uploaded images directly to Cloudinary from the browser,
// with only accept="image/*" on the <input>. This is easily bypassed.
// This route adds server-side validation as a second layer.
//
// Usage: POST this endpoint with { filename, mimeType, sizeBytes, uploadType }
// Returns: { allowed: boolean, reason?: string }

// Allowed types per upload context
const ALLOWED_TYPES: Record<string, string[]> = {
  product_image: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  banner_image:  ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  category_image:['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  product_video: ['video/mp4', 'video/webm'],
  csv_import:    ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'],
  document:      ['application/pdf'],
}

// Max sizes per upload context (bytes)
const MAX_SIZES: Record<string, number> = {
  product_image:  5  * 1024 * 1024,   // 5MB
  banner_image:   8  * 1024 * 1024,   // 8MB
  category_image: 3  * 1024 * 1024,   // 3MB
  product_video:  50 * 1024 * 1024,   // 50MB
  csv_import:     10 * 1024 * 1024,   // 10MB
  document:       10 * 1024 * 1024,   // 10MB
}

// SEC-012, SEC-013: Completely blocked extensions regardless of MIME type
// Attackers can lie about MIME type; we check the filename extension too.
const BLOCKED_EXTENSIONS = [
  '.php', '.phtml', '.php3', '.php4', '.php5', '.phps',
  '.asp', '.aspx', '.ashx', '.asmx',
  '.jsp', '.jspx', '.do', '.action',
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.zsh', '.fish',
  '.ps1', '.psm1', '.vbs', '.vbe', '.js', '.jse',
  '.msi', '.msp', '.msc', '.reg', '.inf',
  '.dll', '.so', '.dylib',
  '.py', '.rb', '.pl', '.cgi',
  '.jar', '.class', '.war',
  '.htaccess', '.htpasswd', '.env',
  '.svg',   // SVG can contain embedded scripts (XSS vector) — disallow in product images
]

// SEC-013: Prevent directory traversal in filenames
function sanitizeFilename(filename: string): string {
  // Remove any path components
  const base = filename.split('/').pop()?.split('\\').pop() || 'upload'
  // Remove any null bytes
  return base.replace(/\0/g, '').trim()
}

function getExtension(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()
  return ext ? `.${ext}` : ''
}

export async function POST(req: NextRequest) {
  // Auth check — only admin/staff can validate uploads
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()

  if (!token) {
    return NextResponse.json({ allowed: false, reason: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ allowed: false, reason: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_blocked')
    .eq('id', user.id)
    .single()

  const ALLOWED_ROLES = ['staff', 'admin', 'manager', 'superadmin']
  if (!profile || !ALLOWED_ROLES.includes(profile.role) || profile.is_blocked) {
    return NextResponse.json({ allowed: false, reason: 'Forbidden' }, { status: 403 })
  }

  // Parse request body
  let body: { filename: string; mimeType: string; sizeBytes: number; uploadType: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ allowed: false, reason: 'Invalid request body' }, { status: 400 })
  }

  const { filename, mimeType, sizeBytes, uploadType } = body

  if (!filename || !mimeType || !sizeBytes || !uploadType) {
    return NextResponse.json({ allowed: false, reason: 'Missing required fields: filename, mimeType, sizeBytes, uploadType' }, { status: 400 })
  }

  // Sanitise filename (SEC-013: directory traversal prevention)
  const safeFilename = sanitizeFilename(filename)
  const ext = getExtension(safeFilename)

  // SEC-012, FILE-020: Block dangerous extensions
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({
      allowed: false,
      reason: `File type "${ext}" is not allowed. Executable and script files are blocked for security.`,
    })
  }

  // FILE-019, FILE-020: Validate MIME type against allowed list for upload type
  const allowedMimes = ALLOWED_TYPES[uploadType]
  if (!allowedMimes) {
    return NextResponse.json({ allowed: false, reason: `Unknown upload type: ${uploadType}` }, { status: 400 })
  }

  if (!allowedMimes.includes(mimeType.toLowerCase())) {
    return NextResponse.json({
      allowed: false,
      reason: `File type "${mimeType}" is not allowed for ${uploadType}. Allowed: ${allowedMimes.join(', ')}`,
    })
  }

  // FILE-005, PROD-028: Validate file size
  const maxSize = MAX_SIZES[uploadType]
  if (sizeBytes > maxSize) {
    const maxMB = (maxSize / 1024 / 1024).toFixed(0)
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(1)
    return NextResponse.json({
      allowed: false,
      reason: `File too large (${sizeMB}MB). Maximum size for ${uploadType} is ${maxMB}MB.`,
    })
  }

  // All checks passed
  return NextResponse.json({
    allowed: true,
    safeFilename,
    uploadType,
    maxSizeBytes: maxSize,
  })
}

// Also export GET for health check in development
export async function GET() {
  return NextResponse.json({ status: 'upload-validate endpoint active' })
}
