# Manual Schema Cache Fix - Direct SQL

## If you can't use `supabase link`, follow these manual steps:

### Option 1: Using Supabase Dashboard SQL Editor (Recommended)

1. Go to: https://supabase.com/dashboard/projects/lgqfkuvswbvqljixashq/sql/new
2. Copy and paste each SQL migration below in order
3. Run each one (click the Play button)
4. Then go to Settings → Database and refresh the connection

### Option 2: Verify column exists

First, check if the column actually exists:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'discipline_referrals' 
ORDER BY ordinal_position;
```

If `student_name` is missing, run this to add it:

```sql
ALTER TABLE public.discipline_referrals
ADD COLUMN IF NOT EXISTS student_name text NOT NULL DEFAULT '';
```

### Option 3: Complete Schema Reset (Nuclear Option)

Run these queries in Supabase SQL Editor in order:

**Query 1:** Check current table structure
```sql
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'discipline_referrals' 
ORDER BY ordinal_position;
```

**Query 2:** If `student_name` is missing, add it
```sql
ALTER TABLE public.discipline_referrals
ADD COLUMN IF NOT EXISTS student_name text NOT NULL DEFAULT '';

ALTER TABLE public.discipline_referrals
ADD COLUMN IF NOT EXISTS student_id text NOT NULL DEFAULT '';
```

**Query 3:** Ensure office columns exist
```sql
ALTER TABLE public.discipline_referrals
ADD COLUMN IF NOT EXISTS referring_office TEXT DEFAULT 'discipline',
ADD COLUMN IF NOT EXISTS target_office TEXT,
ADD COLUMN IF NOT EXISTS inter_office_document_request_id UUID;
```

**Query 4:** Standardize office values
```sql
UPDATE public.discipline_referrals 
SET target_office = 'health'
WHERE target_office IS NULL OR target_office = '';

UPDATE public.discipline_referrals 
SET referring_office = 'discipline'
WHERE referring_office IS NULL OR referring_office = '';
```

## Then in Your Application:

1. Stop dev server (Ctrl+C)
2. Clear cache:
   ```bash
   rm -rf .supabase\schema
   ```
3. Restart:
   ```bash
   npm run dev
   ```

## Verify It Works

Try creating a referral in Discipline Office. If it works, you'll see:
- No schema cache error ✅
- Referral created successfully ✅
- Data appears in Supabase ✅
