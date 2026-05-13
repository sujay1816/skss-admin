# SKSS Admin — Fix Package

## Files changed (4 files, TypeScript: 0 errors)

### app/login/page.tsx
- **Bug fixed:** `router.push('/dashboard')` → `window.location.href = '/dashboard'`
- **Why:** Client-side navigation doesn't commit the Supabase auth cookie before
  middleware runs, causing an immediate bounce back to /login.
  Full page reload guarantees the cookie is sent with the next request.

### app/orders/page.tsx
- **Bug fixed:** Fetched ALL orders into memory, paginated in JS
- **Why:** With 1000+ orders this causes slow loads, high memory use, and
  Supabase default row limits being hit.
- **Fix:** Server-side pagination with `.range(from, to)` + `{ count: 'exact' }`.
  Each page change / search / status filter triggers a new DB query for just 30 rows.

### app/products/page.tsx
- **Bug fixed:** Same fetch-all pattern as orders
- **Fix:** Server-side `.range()` pagination. Search uses `.ilike()` server-side.
  Page/search/filter changes all trigger fresh DB queries.

### components/layout/AdminLayout.tsx
- **Bug fixed:** No error boundary — any JS error shows a blank white screen
- **Fix:** Added React ErrorBoundary class component wrapping all admin pages.
  Errors show a friendly "Something went wrong — Reload page" screen
  instead of a blank page.

## Still needs your action

1. **get_total_revenue RPC** — Verify this Postgres function exists in Supabase.
   Dashboard revenue stat will show ₹0 silently if missing.
   SQL: `CREATE OR REPLACE FUNCTION get_total_revenue() RETURNS TABLE(sum numeric) ...`

2. **window.confirm() calls** — Consider replacing with inline confirm UI in:
   - app/products/page.tsx (delete product)
   - app/returns/page.tsx (approve/reject)
   - app/notifications/page.tsx (clear all)
   These are functional but look unprofessional on mobile.
