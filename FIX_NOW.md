# 🔧 CRITICAL: Fix the "student_name column not found" Error

## ⚠️ The Real Problem

The error occurs because:
1. ✅ Your code is correct
2. ✅ Your dev server is running
3. ❌ Your **Supabase database is missing the required columns and tables**
4. ❌ The **migrations have NOT been deployed**

## Solution: Deploy Migrations to Supabase

You MUST run the SQL migrations in your Supabase database. Here's how:

### Step 1: Open Supabase Dashboard

Go to: **https://supabase.com/dashboard/projects/lgqfkuvswbvqljixashq/sql/new**

You'll see a blank SQL editor.

### Step 2: Run Migration #1 - Helper Functions

Copy and paste this, then click **Play ▶️**:

```sql
-- Helper functions for safe office type casting
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

Wait for the ✅ to appear, then continue.

### Step 3: Run Migration #2 - Add Missing Columns

```sql
-- Add missing columns to discipline_referrals table
ALTER TABLE public.discipline_referrals
ADD COLUMN IF NOT EXISTS referring_office TEXT DEFAULT 'discipline',
ADD COLUMN IF NOT EXISTS target_office TEXT,
ADD COLUMN IF NOT EXISTS inter_office_document_request_id UUID;

-- Add comments
COMMENT ON COLUMN public.discipline_referrals.referring_office IS 'Office that created the referral';
COMMENT ON COLUMN public.discipline_referrals.target_office IS 'Office receiving the referral';
COMMENT ON COLUMN public.discipline_referrals.inter_office_document_request_id IS 'Optional FK to document request';

-- Create indexes
CREATE INDEX IF NOT EXISTS discipline_referrals_target_office_idx 
  ON public.discipline_referrals (target_office);
```

✅ Wait for success.

### Step 4: Run Migration #3 - Standardize Office Values ⭐ CRITICAL

```sql
-- Standardize office values in discipline_referrals
UPDATE public.discipline_referrals 
SET target_office = LOWER(TRIM(COALESCE(target_office, '')))
WHERE target_office IS NOT NULL AND target_office != '';

UPDATE public.discipline_referrals
SET target_office = 'health'
WHERE target_office IS NULL OR target_office = '';

-- Standardize office values in sdao_referrals
UPDATE public.sdao_referrals
SET receiving_office = 'health'
WHERE receiving_office ILIKE '%health%' 
   OR receiving_office ILIKE '%hso%'
   OR receiving_office ILIKE '%Health Services%';

UPDATE public.sdao_referrals
SET receiving_office = 'sdao'
WHERE receiving_office ILIKE '%sdao%' 
   OR receiving_office ILIKE '%development%'
   OR receiving_office ILIKE '%Student Development%';

UPDATE public.sdao_referrals
SET receiving_office = LOWER(receiving_office)
WHERE receiving_office IS NOT NULL;
```

✅ Wait for success.

### Step 5: Run Migration #4 - Create Views

```sql
-- Drop old views
DROP VIEW IF EXISTS hso_discipline_referrals CASCADE;
DROP VIEW IF EXISTS hso_sdao_referrals CASCADE;
DROP VIEW IF EXISTS sdao_outgoing_referrals CASCADE;
DROP VIEW IF EXISTS do_sent_referrals CASCADE;

-- HSO can see discipline referrals
CREATE VIEW public.hso_discipline_referrals AS
SELECT id, student_name, student_id, reason, status, 'discipline' as source_office, 
       target_office, referral_date as created_at, updated_at
FROM public.discipline_referrals
WHERE target_office = 'health' 
  AND status NOT IN ('cancelled', 'rejected', 'declined')
ORDER BY referral_date DESC;

GRANT SELECT ON public.hso_discipline_referrals TO authenticated;

-- HSO can see SDAO referrals
CREATE VIEW public.hso_sdao_referrals AS
SELECT id, student_name, student_id, reason, status, 'sdao' as source_office, 
       receiving_office, created_at, updated_at
FROM public.sdao_referrals
WHERE receiving_office = 'health' 
  AND status NOT IN ('cancelled', 'rejected', 'declined')
ORDER BY created_at DESC;

GRANT SELECT ON public.hso_sdao_referrals TO authenticated;

-- SDAO outgoing referrals
CREATE VIEW public.sdao_outgoing_referrals AS
SELECT id, student_name, student_id, reason, status, receiving_office as target_office, 
       'sdao' as source_office, created_at, updated_at
FROM public.sdao_referrals
WHERE status NOT IN ('cancelled', 'rejected', 'declined')
ORDER BY created_at DESC;

GRANT SELECT ON public.sdao_outgoing_referrals TO authenticated;

-- DO sent referrals
CREATE VIEW public.do_sent_referrals AS
SELECT id, student_name, student_id, reason, status, target_office, 
       'discipline' as source_office, referral_date as created_at, updated_at
FROM public.discipline_referrals
WHERE referring_office = 'discipline' 
  AND status NOT IN ('cancelled', 'rejected', 'declined')
ORDER BY referral_date DESC;

GRANT SELECT ON public.do_sent_referrals TO authenticated;
```

✅ Wait for success.

## Step 6: Verify Migrations Worked

Run this query to check:

```sql
-- Check column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'discipline_referrals' 
  AND column_name = 'student_name';

-- Check office values are standardized
SELECT DISTINCT receiving_office 
FROM sdao_referrals 
WHERE receiving_office IS NOT NULL
ORDER BY receiving_office;
```

**Expected:**
- First query: Returns 1 row with "student_name" ✅
- Second query: Returns values like: health, sdao, discipline, counseling ✅

## Step 7: Test in Application

1. **Go to app**: http://localhost:5175
2. **Sign in** as Discipline Office staff
3. **Create a referral** - should NOT get schema cache error ✅
4. **Fill in fields** - should accept student_name without error ✅
5. **Submit** - referral should be created successfully ✅

## 🚨 If You Still Get Errors

### Error: "Cannot find the table..."

**This means:** The migrations didn't run properly.

**Fix:**
1. Go back to each migration
2. Check the error message
3. Copy the exact error text
4. Try the migration again

### Error: "student_name is required"

**This means:** The column exists but the table is empty or has no default values.

**Fix:** This is normal - just fill in the student_name field when creating a referral.

### Error: "Column does not exist"

**This means:** The migration didn't execute.

**Fix:**
1. Check if you got a ✅ after clicking Play
2. If not, copy the exact error message
3. Try the migration again

## ✅ Success Indicators

After completing all steps, you should be able to:

1. ✅ Create referral in DO without schema errors
2. ✅ Field inputs accept data (student_name, student_id, etc.)
3. ✅ Referral submits successfully
4. ✅ Data appears in Supabase database
5. ✅ HSO sees incoming referrals
6. ✅ Real-time updates work

## 📝 Important Notes

- **Do NOT skip any migration** - they must run in order
- **Wait for ✅ after each step** - don't rush
- **Copy the ENTIRE SQL block** - don't just parts of it
- **If error appears**, it usually means something is wrong with the SQL syntax

## 🆘 Last Resort

If migrations fail repeatedly:

1. Go to **Settings** → **SQL Editor** in Supabase
2. Click **Reset database**
3. Re-run all 4 migrations from scratch

This will wipe your database, so only do this if you don't have important data!

---

**Your dev server is already running on http://localhost:5175** ✅

**Just need to run the Supabase migrations and you're done!** 🎉
