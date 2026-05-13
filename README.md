# SKSS Admin — QA Fix Package

Generated from analysis of the enterprise QA checklist (872 test cases).
All 9 issues fixed. **TypeScript: 0 errors.**

---

## Files Changed (9 files + 1 new component + 2 new API routes)

| File | QA IDs Fixed | What was wrong | What's fixed |
|---|---|---|---|
| `next.config.js` | AUTH-052, SEC-017–021, DEPL-012 | No security headers on any page | X-Frame-Options, X-Content-Type-Options, HSTS, CSP, Referrer-Policy, Permissions-Policy, X-Robots-Tag added |
| `middleware.ts` | AUTH-040, SEC-015, AUTH-029 | No rate limiting on login; open-redirect possible via ?redirect=https://evil.com | IP-based rate limiter (10 attempts / 15 min window, 429 + Retry-After); redirect param validated to be relative path only |
| `components/ui/ConfirmModal.tsx` | CPN, NTFY, PROD, Returns | All confirm dialogs used `window.confirm()` — blocks browser thread, fails on mobile, looks unprofessional | New `useConfirm()` hook returns a promise-based modal component used across all pages |
| `app/products/page.tsx` | PROD UX | `window.confirm()` on delete | Uses `ConfirmModal` |
| `app/coupons/page.tsx` | CPN-028, CPN UX | `window.confirm()` on delete; percentage > 100 not validated | `ConfirmModal` + percent ≤ 100 validation + value > 0 validation |
| `app/returns/page.tsx` | Returns UX | Approve/Reject acted immediately with no confirmation | `ConfirmModal` before approve and reject |
| `app/notifications/page.tsx` | NTFY UX | `window.confirm()` on Clear All | `ConfirmModal` |
| `app/products/new/page.tsx` | PROD-005, PROD-006, PROD-008, PROD-027, PROD-028 | No validation for negative price, sale > original, negative stock; no client-side image type/size check | All validations added; `min=0` on stock inputs; image type (JPEG/PNG/WebP only) and size (≤5MB) checked before upload |
| `app/products/[id]/page.tsx` | PROD-005, PROD-006, PROD-008, PROD-027, PROD-028 | Same as above on the edit page | Same fixes applied |
| `app/orders/[id]/page.tsx` | ORD-008, ORD-020 | All status options shown regardless of current state; no duplicate refund prevention | `VALID_TRANSITIONS` map enforces allowed next states; terminal orders (cancelled, refunded, return_rejected) show read-only notice; select dropdown only shows valid transitions |
| `app/api/whatsapp/route.ts` | API-006 | No authentication check — any unauthenticated request could call this | Requires valid Bearer token + admin/staff role before processing |
| `app/api/upload-validate/route.ts` | FILE-019, FILE-020, SEC-012, SEC-013 | No server-side file validation; executable uploads (.php, .exe, .sh etc.) not blocked; no directory traversal protection | New API route: validates MIME type, file size, and extension; blocks all executable/script extensions; sanitises filenames to prevent path traversal |
| `app/api/audit-logs/route.ts` | SEC-024, AUDT-013, AUDT-014 | No audit log API with tamper prevention | Append-only API: POST creates entries, GET reads them, DELETE/PUT/PATCH all return 403 |

---

## How to apply

```bash
# Copy all files into your skss-admin repo, preserving directory structure
cp -r admin-qa-fixes/* /path/to/skss-admin/

# Install dependencies (no new packages needed)
npm install

# TypeScript check
npx tsc --noEmit
# → 0 errors

# Run dev server
npm run dev
```

---

## Issues NOT fixable in code (require Supabase/infrastructure action)

| QA ID | Issue | Required Action |
|---|---|---|
| SEC-022 | Passwords stored as hash | Already handled by Supabase Auth (bcrypt) — no code change needed |
| PAY-017, LIVE-002 | Razorpay test key in production | Set `NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_...` in Vercel production |
| LIVE-008 | RLS on all Supabase tables | Verify in Supabase Dashboard → Table Editor → RLS enabled on every table |
| LIVE-009 | `get_total_revenue` RPC missing | Create SQL function in Supabase: `CREATE OR REPLACE FUNCTION get_total_revenue() RETURNS TABLE(sum numeric) LANGUAGE sql AS $$ SELECT COALESCE(SUM(total_amount),0) AS sum FROM orders WHERE payment_status='paid' AND status != 'cancelled'; $$;` |
| AUDT-013/014 | Audit log tamper at DB level | Add RLS: no UPDATE/DELETE policy on `audit_logs` table |
| SEC-024 | Audit log append-only at DB level | Same as above — the API layer blocks it, but DB RLS is the true guard |
| INV-007, EDGE-014 | Stock race condition during concurrent checkout | Requires `SELECT ... FOR UPDATE` or Supabase atomic RPC — must be done in a Supabase Edge Function or DB trigger |
| CPN-022, EDGE-015 | Coupon over-redemption under load | Requires DB-level atomic decrement via `UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ? AND usage_count < max_usage_count` |

---

## QA test cases that should now PASS after this fix package

AUTH-040, AUTH-052, SEC-015, SEC-017, SEC-018, SEC-019, SEC-020, SEC-021,
AUTH-029, PROD-005, PROD-006, PROD-008, PROD-027, PROD-028, ORD-008, ORD-020,
FILE-019, FILE-020, SEC-012, SEC-013, API-006, SEC-024, AUDT-013, AUDT-014,
CPN-028 + all `window.confirm()` UX items (coupons/returns/notifications/products)
