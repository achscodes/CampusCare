# 🔧 Final Setup: Manual Database Migration

**Your dev server is running! ✅** Now you need to apply the database migrations.

## Step 1: Go to Supabase SQL Editor

1. Open: https://supabase.com/dashboard/projects/lgqfkuvswbvqljixashq/sql/new
2. You'll see a blank SQL editor

## Step 2: Run Each Migration in Order

### Migration 1: Fix Referral Visibility
Copy everything below and run in Supabase SQL Editor:

```sql
-- Migration: Fix referral visibility and RLS policies
-- ============================================
-- Helper functions for safe office type casting
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_office()
RETURNS TEXT AS $$
DECLARE
  office TEXT;
BEGIN
  SELECT office INTO office FROM public.profiles 
  WHERE id = auth.uid() LIMIT 1;
  RETURN COALESCE(office, 'health');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'staff', 'welfare_admin')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

Then click the **Play button** ▶ to execute.

### Migration 2: Add Missing Columns to Discipline Referrals

```sql
-- Add missing columns to discipline_referrals table
ALTER TABLE public.discipline_referrals
ADD COLUMN IF NOT EXISTS referring_office TEXT DEFAULT 'discipline',
ADD COLUMN IF NOT EXISTS target_office TEXT,
ADD COLUMN IF NOT EXISTS inter_office_document_request_id UUID;

-- Add comments
COMMENT ON COLUMN public.discipline_referrals.referring_office IS 'Office that created the referral (default: discipline)';
COMMENT ON COLUMN public.discipline_referrals.target_office IS 'Office receiving the referral (e.g., development, health)';
COMMENT ON COLUMN public.discipline_referrals.inter_office_document_request_id IS 'Optional FK to inter-office document request';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS discipline_referrals_target_office_idx 
  ON public.discipline_referrals (target_office);

CREATE INDEX IF NOT EXISTS discipline_referrals_office_date_idx 
  ON public.discipline_referrals (referring_office, target_office, referral_date DESC);
```

Click **Play** ▶ to execute.

### Migration 3: Standardize Office Values

This is the **CRITICAL** migration that fixes the main issue:

```sql
-- Standardize ALL office values in both tables to use enum values

-- For discipline_referrals: standardize to lowercase
UPDATE public.discipline_referrals 
SET target_office = LOWER(TRIM(COALESCE(target_office, '')))
WHERE target_office IS NOT NULL AND target_office != '';

UPDATE public.discipline_referrals
SET target_office = 'health'
WHERE target_office IS NULL OR target_office = '';

UPDATE public.discipline_referrals 
SET referring_office = LOWER(TRIM(COALESCE(referring_office, 'discipline')));

-- For sdao_referrals: map all variations to standard enum values
UPDATE public.sdao_referrals
SET receiving_office = 'health'
WHERE receiving_office ILIKE '%health%' OR receiving_office ILIKE '%hso%'
  OR receiving_office ILIKE '%Health Services%';

UPDATE public.sdao_referrals
SET receiving_office = 'discipline'
WHERE receiving_office ILIKE '%discipline%' OR receiving_office ILIKE '%do%'
  OR receiving_office ILIKE '%Discipline Office%';

UPDATE public.sdao_referrals
SET receiving_office = 'sdao'
WHERE receiving_office ILIKE '%sdao%' OR receiving_office ILIKE '%development%'
  OR receiving_office ILIKE '%Student Development%';

UPDATE public.sdao_referrals
SET receiving_office = 'counseling'
WHERE receiving_office ILIKE '%counseling%' OR receiving_office ILIKE '%guidance%';

-- Standardize to lowercase
UPDATE public.sdao_referrals SET receiving_office = LOWER(receiving_office)
  WHERE receiving_office IS NOT NULL;
UPDATE public.sdao_referrals SET referring_office = LOWER(referring_office)
  WHERE referring_office IS NOT NULL;
```

Click **Play** ▶ to execute.

### Migration 4: Complete Referral System Fix

```sql
-- Create simple, reliable views for cross-office referrals

-- HSO can see discipline referrals sent to health
DROP VIEW IF EXISTS hso_discipline_referrals CASCADE;
CREATE VIEW public.hso_discipline_referrals AS
SELECT
  id,
  student_name,
  student_id,
  reason,
  status,
  'discipline' as source_office,
  target_office,
  referral_date as created_at,
  updated_at
FROM public.discipline_referrals
WHERE target_office = 'health'
  AND status NOT IN ('cancelled', 'rejected', 'declined', 'Cancelled', 'Rejected', 'Declined')
ORDER BY referral_date DESC;

GRANT SELECT ON public.hso_discipline_referrals TO authenticated;

-- HSO can see SDAO referrals received
DROP VIEW IF EXISTS hso_sdao_referrals CASCADE;
CREATE VIEW public.hso_sdao_referrals AS
SELECT
  id,
  student_name,
  student_id,
  reason,
  status,
  'sdao' as source_office,
  receiving_office,
  created_at,
  updated_at
FROM public.sdao_referrals
WHERE receiving_office = 'health'
  AND status NOT IN ('cancelled', 'rejected', 'declined', 'Cancelled', 'Rejected', 'Declined')
ORDER BY created_at DESC;

GRANT SELECT ON public.hso_sdao_referrals TO authenticated;

-- SDAO can see their outgoing referrals
DROP VIEW IF EXISTS sdao_outgoing_referrals CASCADE;
CREATE VIEW public.sdao_outgoing_referrals AS
SELECT
  id,
  student_name,
  student_id,
  reason,
  status,
  receiving_office as target_office,
  'sdao' as source_office,
  created_at,
  updated_at
FROM public.sdao_referrals
WHERE status NOT IN ('cancelled', 'rejected', 'declined', 'Cancelled', 'Rejected', 'Declined')
ORDER BY created_at DESC;

GRANT SELECT ON public.sdao_outgoing_referrals TO authenticated;

-- DO can see referrals they sent
DROP VIEW IF EXISTS do_sent_referrals CASCADE;
CREATE VIEW public.do_sent_referrals AS
SELECT
  id,
  student_name,
  student_id,
  reason,
  status,
  target_office,
  'discipline' as source_office,
  referral_date as created_at,
  updated_at
FROM public.discipline_referrals
WHERE referring_office = 'discipline'
  AND status NOT IN ('cancelled', 'rejected', 'declined', 'Cancelled', 'Rejected', 'Declined')
ORDER BY referral_date DESC;

GRANT SELECT ON public.do_sent_referrals TO authenticated;
```

Click **Play** ▶ to execute.

## Step 3: Verify It Worked

Run this query to check office values are standardized:

```sql
-- Check SDAO referrals office values
SELECT DISTINCT receiving_office 
FROM sdao_referrals 
WHERE receiving_office IS NOT NULL
ORDER BY receiving_office;

-- Check Discipline referrals office values
SELECT DISTINCT target_office 
FROM discipline_referrals 
WHERE target_office IS NOT NULL
ORDER BY target_office;

-- Check DO referrals office values
SELECT DISTINCT referring_office
FROM discipline_referrals
WHERE referring_office IS NOT NULL
ORDER BY referring_office;
```

**Expected output:** health, discipline, sdao, counseling, (and maybe NULL)

If you see these values, the fix worked! ✅

## Step 4: Test in Application

1. Go to **http://localhost:5175** (your dev server)
2. Log in as **Discipline Office staff**
3. Try to **create a referral** to SDAO
4. If it works without schema cache errors, you're good! ✅

## Step 5: Verify Referral Visibility

### Test SDAO→HSO Referral
1. Log in as SDAO staff
2. Create a referral to "Health Services Office"
3. Switch to HSO staff account
4. Check "Incoming Referrals" → Should see the new referral ✅

### Test DO→SDAO Referral
1. Log in as DO staff
2. Create a referral to "SDAO" or "Student Development"
3. Switch to SDAO staff account
4. Check incoming referrals → Should see the new referral ✅

## 🐛 If Still Getting Schema Cache Error

1. Stop dev server (Ctrl+C)
2. Clear cache again:
   ```powershell
   Remove-Item -Path ".supabase\schema" -Recurse -Force
   ```
3. Restart: `npm run dev`
4. Hard refresh browser: **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)

## ✨ What Was Fixed

| Issue | Solution | File |
|-------|----------|------|
| "student_name column not found" | Cache cleared, schema reloaded | `.supabase/schema/` |
| SDAO referrals not visible to HSO | Office values standardized (receiving_office = 'health') | Migration 3 |
| DO→SDAO creation failing | Columns added, office values normalized | Migration 2 |
| Real-time updates not working | Listeners updated to use 'sdao' instead of 'development' | SDAO.jsx |
| Service layer queries failing | Updated to use standardized values | sdaoSupabase.js, hsoSupabase.js |

---

## Need Help?

If any step fails, check:
1. Are you logged into Supabase? (Top right should show your project)
2. Did you get any error messages? (Copy the error)
3. Did you run migrations in the correct order?

**If you can't get past the schema cache issue:** 
- Try restarting your computer
- Or: Clear ALL browser cache (Ctrl+Shift+Delete), then try again
