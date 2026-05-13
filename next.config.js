/** @type {import('next').NextConfig} */

// QA FIXES — AUTH-052, SEC-017, SEC-018, SEC-019, SEC-020, SEC-021, DEPL-012
// Added security headers on all admin page responses:
//   X-Frame-Options        → prevents clickjacking (SEC-028)
//   X-Content-Type-Options → prevents MIME sniffing (SEC-021)
//   Referrer-Policy        → limits referrer leakage
//   Permissions-Policy     → disable unnecessary browser APIs
//   Strict-Transport-Security → enforces HTTPS (SEC-020)
//   Content-Security-Policy   → restricts script/style/image sources (SEC-019)
//
// Note: HTTPS redirect is handled by Vercel (SEC-017/AUTH-030) — no code change needed.
// Note: next.config.js runs at build time; headers() runs at runtime per-request.

const securityHeaders = [
  {
    // Prevent clickjacking — admin should never be embedded in an iframe
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    // Prevent MIME-type sniffing attacks
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // Don't send referrer to external sites (hides admin URL in referrer headers)
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // Disable browser APIs the admin panel doesn't need
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  {
    // HSTS — force HTTPS for 1 year, include subdomains
    // max-age=31536000 is the standard 1-year value
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    // Content Security Policy
    // - default-src 'self'            → only own origin by default
    // - script-src 'self' 'unsafe-inline' → Next.js inline scripts need unsafe-inline
    //   (tighten to nonce-based in future; this is the pragmatic baseline)
    // - style-src 'self' 'unsafe-inline' → Tailwind inline styles
    // - img-src * data: blob:            → product images from Cloudinary + Supabase
    // - connect-src 'self' *.supabase.co api.cloudinary.com fast2sms.com
    // - frame-ancestors 'none'           → redundant with X-Frame-Options but belt+braces
    // - upgrade-insecure-requests        → force HTTP sub-resources to HTTPS
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src * data: blob:",
      "media-src * blob:",
      "font-src 'self' data:",
      "connect-src 'self' *.supabase.co wss://*.supabase.co https://api.cloudinary.com https://www.fast2sms.com https://api.razorpay.com",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
  {
    // Tell search engines not to index admin pages (DEPL-003)
    key: 'X-Robots-Tag',
    value: 'noindex, nofollow',
  },
]

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },

  // Apply security headers to every admin route
  async headers() {
    return [
      {
        // Match all admin pages and API routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
