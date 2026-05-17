# Schema Cache Error Fix: "student_name column not found"

## 🔴 Problem

When creating referrals in Discipline Office (DO), you get:
```
Could not find the 'student_name' column of 'discipline_referrals' in the schema cache
```

## 🔍 Root Cause

The `student_name` column **DOES exist** in the database, but Supabase's local schema cache is stale.

This happens when:
1. Recent migrations were deployed
2. The schema cache wasn't refreshed after deployment
3. The database schema changed but the application is still using old cached metadata

## ✅ Quick Fix (3 Steps)

### Option 1: Using Terminal (Recommended for Windows)

Open PowerShell in the project directory and run:

```powershell
# Step 1: Link to your Supabase project (if not already linked)
supabase link

# Step 2: Deploy pending migrations
supabase db push

# Step 3: Clear the schema cache
supabase db pull --linked
```

Then restart your development server:
```
npm run dev
```

### Option 2: Using Bash/Shell

```bash
supabase link
supabase db push
supabase db pull --linked
```

### Option 3: Automatic Script

Windows users can run:
```powershell
.\fix-schema-cache.ps1
```

## 🔧 If That Doesn't Work

### Manual Verification

1. **Verify the column exists in database:**
   - Go to Supabase Dashboard
   - Select your project
   - Go to SQL Editor
   - Run this query:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'discipline_referrals' 
   ORDER BY ordinal_position;
   ```
   - Look for `student_name` (should be type `text`)

2. **If the column doesn't exist**, run this in Supabase SQL Editor:
   ```sql
   ALTER TABLE public.discipline_referrals
   ADD COLUMN IF NOT EXISTS student_name text not null default '';
   ```

3. **Clear cache and restart:**
   ```bash
   supabase db pull --linked
   npm run dev
   ```

### Hard Reset Cache

If the quick fix doesn't work, try a complete reset:

```bash
# 1. Remove local schema cache
rm -rf .supabase/schema  # Linux/Mac
rmdir /s .supabase\schema  # Windows

# 2. Re-link to project
supabase link --project-ref YOUR_PROJECT_REF

# 3. Pull fresh schema
supabase db pull --linked

# 4. Restart dev server
npm run dev
```

## 📋 Troubleshooting Steps

| Step | Command | What It Does |
|------|---------|-------------|
| 1 | `supabase link` | Connects CLI to your Supabase project |
| 2 | `supabase db push` | Deploys any pending migrations |
| 3 | `supabase db pull --linked` | **Clears schema cache** and syncs |
| 4 | `npm run dev` | Restarts dev server with fresh schema |

## 🚨 If Error Persists

1. **Check if migrations deployed:**
   ```bash
   supabase migration list
   ```
   Should show recent migrations like:
   - `20260513000003_add_office_columns_to_discipline_referrals`
   - `20260513000007_complete_referral_system_fix`

2. **Check table structure directly:**
   ```bash
   supabase db remote commit  # Commits any schema changes
   supabase db pull           # Pulls fresh schema
   ```

3. **Nuclear option** (if nothing else works):
   ```bash
   # Delete all local TypeScript files for schema
   rm -rf lib/database.types.ts expo-env.d.ts
   
   # Regenerate from scratch
   supabase gen types typescript --linked --schema public > lib/database.types.ts
   
   # Clear cache
   supabase db pull --linked
   
   # Restart
   npm run dev
   ```

## 📝 What This Error Means

```
schema cache error
    ↓
Supabase client thinks column doesn't exist
    ↓
But it actually does exist in the database
    ↓
The client's local metadata is just outdated
    ↓
Solution: Refresh the cached metadata (supabase db pull)
```

## 🎯 Expected Result After Fix

After running the fix, you should be able to:

1. **Create a referral from DO to SDAO:**
   - Student Name: ✅ Accepts input
   - Student ID: ✅ Accepts input
   - Referral Type: ✅ Accepts input
   - Submit: ✅ Works without schema errors

2. **Verify in database:**
   ```sql
   SELECT id, student_name, student_id, reason FROM discipline_referrals 
   WHERE created_at > now() - interval '1 hour' 
   LIMIT 5;
   ```
   Should show your newly created referral ✅

## 🔍 Additional Diagnostics

### Check Current Schema Version

```bash
# Lists all migrations and which ones are deployed
supabase migration list

# Check your Supabase project's remote migrations
supabase migration list --linked
```

### Verify Supabase Connection

```bash
# Test Supabase CLI is working
supabase status

# Should show:
# Connected to project: [YOUR_PROJECT_REF]
# Database: PostgreSQL 14.0
# etc.
```

### Force Regenerate Types

```bash
# This is safe and won't modify your database
supabase gen types typescript --linked > lib/database.types.ts

# If using JavaScript instead
supabase gen types typescript --linked > supabase/types.ts
```

## ✨ Summary

The fix is simple:
1. Deploy migrations: `supabase db push`
2. Clear cache: `supabase db pull --linked`
3. Restart: `npm run dev`

That's it! The schema cache will be refreshed and the error should disappear.
