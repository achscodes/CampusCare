# Fix: DO→SDAO Referral Creation Error

## Problem
When Discipline Office (DO) staff tries to create a referral to Student Development Affairs Office (SDAO), they get the error:
```
Could not find the 'student_name' column of 'discipline_referrals' in the schema cache
```

## Root Cause
The `discipline_referrals` table was missing two office-related columns that the application code was trying to insert:
- `referring_office` (which office sent the referral)
- `target_office` (which office should receive it)

The schema cache error was triggered because the database returned an unexpected error when trying to insert into these non-existent columns.

## Solution Applied

### 1. New Migration: `20260513000003_add_office_columns_to_discipline_referrals.sql`
This migration:
- ✅ Adds `referring_office` column (defaults to 'discipline')
- ✅ Adds `target_office` column (for destination office like 'sdao', 'health')
- ✅ Adds `inter_office_document_request_id` column (for linking to document requests)
- ✅ Creates indexes for office-based queries
- ✅ Standardizes office values to lowercase

### 2. Updated Mapper: `src/utils/disciplineOfficeMappers.js`
- Ensured `referralToInsert()` properly handles optional fields
- Added support for `interOfficeDocumentRequestId` when provided

## Steps to Deploy

### Step 1: Apply Migration
```sql
-- Run in Supabase SQL Editor or via CLI:
supabase db push
```

**Or manually in Supabase:**
1. Go to SQL Editor
2. Paste contents of: `supabase/migrations/20260513000003_add_office_columns_to_discipline_referrals.sql`
3. Click "Run"

### Step 2: Clear Schema Cache
Supabase automatically reloads the schema, but you can force a refresh:

```bash
# If using Supabase CLI:
supabase db pull

# Or in Supabase dashboard:
# - Go to API > Usage
# - The schema should auto-refresh within seconds
```

### Step 3: Verify Fix
Run this in Supabase SQL Editor to confirm columns exist:
```sql
-- Check discipline_referrals columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'discipline_referrals' 
ORDER BY ordinal_position;

-- Should see: referring_office, target_office, inter_office_document_request_id
```

### Step 4: Test Referral Creation
1. Log in as Discipline Office staff
2. Go to Referrals tab
3. Click "New Referral"
4. Fill in details:
   - Student ID
   - Student Name
   - Referral Type
   - Reason
   - **Refer to office: SDAO — Student Development**
5. Add attachment (optional)
6. Click "Create Referral"

## Expected Behavior

### ✅ After Fix
- DO staff can create referrals TO SDAO
- Referrals TO SDAO have `target_office = 'sdao'`
- SDAO staff can view incoming referrals from DO
- Referral shows in SDAO's "Incoming from Discipline Office" section

### If Still Getting Errors

**Troubleshooting:**

1. **Schema Cache Still Out of Sync:**
   ```bash
   # Force hard refresh
   supabase db pull --local --linked
   ```

2. **Columns Still Missing:**
   ```sql
   -- Run manual verification
   ALTER TABLE public.discipline_referrals
   ADD COLUMN IF NOT EXISTS referring_office TEXT DEFAULT 'discipline',
   ADD COLUMN IF NOT EXISTS target_office TEXT,
   ADD COLUMN IF NOT EXISTS inter_office_document_request_id UUID;
   ```

3. **Office Values Not Standardized:**
   ```sql
   UPDATE public.discipline_referrals 
   SET target_office = LOWER(TRIM(target_office))
   WHERE target_office IS NOT NULL;
   ```

4. **Indexes Missing:**
   ```sql
   CREATE INDEX IF NOT EXISTS discipline_referrals_target_office_idx 
     ON public.discipline_referrals (target_office);
   ```

## Data Flow After Fix

```
DO Staff Creates Referral
    ↓
Form submits with:
  - studentName
  - studentId
  - referralType
  - reason
  - targetOffice = 'SDAO — Student Development' (SDAO)
    ↓
referralToInsert() maps to:
  - student_name
  - student_id
  - referral_type
  - reason
  - referring_office = 'discipline'
  - target_office = 'sdao'
    ↓
INSERT into discipline_referrals succeeds ✓
    ↓
SDAO staff can query: SELECT * FROM discipline_referrals WHERE target_office = 'sdao'
    ↓
Referral appears in SDAO UI
```

## Database Schema Changes

### Before Fix
```sql
CREATE TABLE discipline_referrals (
  id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  referral_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  referral_date TIMESTAMPTZ NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
  -- ❌ MISSING: referring_office, target_office
);
```

### After Fix
```sql
CREATE TABLE discipline_referrals (
  id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  referral_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  referral_date TIMESTAMPTZ NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  referring_office TEXT DEFAULT 'discipline',        -- ✅ NEW
  target_office TEXT,                                 -- ✅ NEW
  inter_office_document_request_id UUID              -- ✅ NEW
);
```

## Files Changed

1. ✅ `supabase/migrations/20260513000003_add_office_columns_to_discipline_referrals.sql` (NEW)
2. ✅ `src/utils/disciplineOfficeMappers.js` (UPDATED)

## Related Migrations
- `20260513000002_fix_referral_visibility.sql` - Fixes HSO/SDAO referral visibility
- `20260513000001_foreign_keys_and_interconnections.sql` - Links all office tables
- `20260513000000_data_streamline_functions.sql` - Cross-office RPC functions

## Testing Checklist

- [ ] Migration applied successfully
- [ ] Schema cache cleared
- [ ] DO staff can create referrals to SDAO
- [ ] SDAO staff can view incoming DO referrals
- [ ] SDAO staff can create referrals to HSO
- [ ] HSO staff can view incoming SDAO referrals
- [ ] Old referrals still visible (backward compatible)
- [ ] Attachments still work
