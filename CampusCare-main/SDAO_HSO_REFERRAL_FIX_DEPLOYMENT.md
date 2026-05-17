# SDAO→HSO Referral Visibility Fix - Deployment Guide

## Problem Summary
SDAO (Student Development Affairs Office) referrals are not showing in the HSO (Health Services Office) incoming referrals screen, even though they're being created.

**Root Cause:** The `sdao_referrals.receiving_office` column contains display text like "Health Services (inter-office)" instead of the standardized enum value `"health"`. When HSO queries with `.eq("receiving_office", "health")`, it finds no matches.

---

## Solution Overview
Six SQL migrations have been created to:
1. Add missing columns to discipline_referrals table
2. **Standardize all office values** from display text to enum values (health, discipline, sdao, counseling)
3. Create database views for cross-office referral queries
4. Fix Row-Level Security (RLS) policies

---

## Deployment Steps

### Step 1: Access Supabase
1. Go to your Supabase project: https://lgqfkuvswbvqljixashq.supabase.co
2. Click **"SQL Editor"** in the left sidebar
3. Or use Supabase CLI: `supabase db push`

### Step 2: Apply Migrations (In This Exact Order)

**Option A: Using Supabase CLI (Recommended)**
```bash
cd CampusCare-main
supabase db push
```
This automatically applies all new migrations in `supabase/migrations/` in order.

**Option B: Manual SQL Editor (In Supabase Dashboard)**

Copy & paste each migration into the SQL Editor, one at a time:

1. **Migration 1:** `20260513000002_fix_referral_visibility.sql`
   - Fixes RLS policies
   - Creates helper functions

2. **Migration 2:** `20260513000003_add_office_columns_to_discipline_referrals.sql`
   - Adds `referring_office`, `target_office` columns to discipline_referrals
   - Creates indexes

3. **Migration 3:** `20260513000004_standardize_office_values.sql` ⭐ **CRITICAL**
   - **This is the main fix!**
   - Standardizes `sdao_referrals.receiving_office` from display text → enum values
   - Converts "Health Services (inter-office)" → `"health"`
   - Also standardizes discipline_referrals office values

4. **Migration 4:** `20260513000005_hso_incoming_views.sql`
   - Creates views: `hso_incoming_sdao_referrals`, `hso_incoming_discipline_referrals`, `hso_incoming_referrals_unified`
   - These views are used by the application

5. **Migration 5:** `20260513000006_sdao_outgoing_views.sql`
   - Creates views for SDAO outgoing referrals
   - Allows SDAO staff to see where they sent referrals

6. **Migration 6:** `20260513000007_complete_referral_system_fix.sql`
   - Consolidates all fixes
   - Double-checks standardization
   - Creates simplified, reliable views

### Step 3: Verify Standardization

After all migrations complete, run this SQL query in Supabase to verify the fix worked:

```sql
-- Check SDAO referrals office values
SELECT DISTINCT receiving_office 
FROM public.sdao_referrals
WHERE receiving_office IS NOT NULL
ORDER BY receiving_office;
-- Should show: health, discipline, sdao, counseling (no display text!)

-- Check sample SDAO referrals to HSO
SELECT id, student_name, receiving_office, status, created_at
FROM public.sdao_referrals
WHERE receiving_office = 'health'
LIMIT 10;
-- Should return SDAO referrals sent to HSO

-- Check the HSO incoming SDAO referrals view
SELECT * FROM public.hso_sdao_referrals LIMIT 10;
-- Should show all SDAO referrals sent to HSO
```

### Step 4: Clear Application Cache (Important!)

After migrations are deployed, you may need to refresh the application to clear any cached data:

1. **In HSO Portal:**
   - Clear browser cache (Ctrl+F5 on Windows, Cmd+Shift+R on Mac)
   - Logout and login again
   - Navigate to Incoming Referrals section

2. **Check Status:**
   - Go to **Health Services → Referrals → Incoming**
   - Should now show referrals from SDAO (after migrations applied)

---

## How It Works - Before & After

### Before Fix ❌
```
SDAO Staff creates referral to HSO:
├─ receiving_office = "Health Services (inter-office)"  [Display text]
│
HSO Portal queries:
├─ WHERE receiving_office = 'health'  [Enum value]
│
Result: NO MATCH → Referral invisible ❌
```

### After Fix ✅
```
Migration 20260513000004 runs:
├─ UPDATE sdao_referrals 
│  SET receiving_office = 'health'
│  WHERE receiving_office ILIKE '%Health%'
│
SDAO Staff creates NEW referral to HSO:
├─ receiving_office = 'health'  [Enum value]
│
HSO Portal queries:
├─ WHERE receiving_office = 'health'  [Enum value]
│
Result: PERFECT MATCH → Referral visible ✅
```

---

## Troubleshooting

### Issue: "Table does not exist" error
- **Cause:** Migrations not applied in order, or dependencies missing
- **Solution:** Start from Migration 1 again, apply in sequence

### Issue: SDAO referrals still not showing after migrations
1. **Verify migrations applied:**
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_name LIKE 'hso_%' OR table_name LIKE 'sdao_%';
   ```
   Should show the views created by migrations 4, 5, 6

2. **Check receiving_office values:**
   ```sql
   SELECT DISTINCT receiving_office FROM sdao_referrals;
   ```
   Should show ONLY: `health`, `discipline`, `sdao`, `counseling`, `NULL` (no display text!)

3. **Clear browser cache** and refresh HSO portal

### Issue: Permission denied errors
- **Cause:** RLS policies need to be refreshed
- **Solution:** The migrations include `GRANT SELECT` statements. Logout/login in the app to refresh permissions.

---

## Verification Checklist

After deployment:

- [ ] All 6 migrations applied successfully (no errors)
- [ ] `SELECT DISTINCT receiving_office FROM sdao_referrals;` returns only enum values
- [ ] `SELECT * FROM hso_sdao_referrals LIMIT 10;` returns existing SDAO referrals to HSO
- [ ] HSO staff can see SDAO referrals in **Referrals → Incoming** section
- [ ] New SDAO referrals to HSO appear in HSO portal within seconds

---

## Files Changed
- ✅ `supabase/migrations/20260513000002_fix_referral_visibility.sql`
- ✅ `supabase/migrations/20260513000003_add_office_columns_to_discipline_referrals.sql`
- ✅ `supabase/migrations/20260513000004_standardize_office_values.sql`
- ✅ `supabase/migrations/20260513000005_hso_incoming_views.sql`
- ✅ `supabase/migrations/20260513000006_sdao_outgoing_views.sql`
- ✅ `supabase/migrations/20260513000007_complete_referral_system_fix.sql`

---

## Questions?

If SDAO referrals still don't appear in HSO after following these steps:
1. Check that all 6 migrations completed without errors
2. Verify the office values were standardized (SQL query above)
3. Refresh browser cache and re-login
4. Contact support with migration execution logs

---

**Expected Result:** ✅ SDAO referrals will now be visible in HSO's incoming referrals section!
