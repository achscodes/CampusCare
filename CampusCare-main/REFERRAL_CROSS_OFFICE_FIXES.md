# CampusCare Cross-Office Referral Fixes

## Issues Fixed

### 1. **Schema Cache Error: "Could not find the 'student_name' column of 'discipline_referrals'"**

**Root Cause:** The `discipline_referrals` table was missing `referring_office` and `target_office` columns that the code was trying to insert.

**Solution:** Created migration `20260514000000_discipline_referrals_cross_office.sql` to add:
- `referring_office text default 'discipline'` - tracks which office is sending the referral
- `target_office text` - tracks which office should receive the referral
- Indexes on both columns for fast filtering

**File:** `supabase/migrations/20260514000000_discipline_referrals_cross_office.sql`

### 2. **SDAO Referrals Not Showing in HSO Portal**

**Root Cause:** The `loadHsoFromSupabase` function was only fetching discipline referrals, not SDAO referrals with `receiving_office = 'health'`.

**Solution:** Updated `src/services/hsoSupabase.js`:
- Added fetch for `sdao_referrals` with `receiving_office.eq.health`
- Mapped SDAO referral fields to match HSO referral structure
- Return `sdaoReferralsIncoming` array

**File:** `src/services/hsoSupabase.js` - lines 42-95

### 3. **HSO Referrals Not Showing in SDAO Portal**

**Root Cause:** The `loadSdaoFromSupabase` function was only fetching discipline referrals to development office, not health referrals with `receiving_office = 'development'`.

**Solution:** Updated `src/services/sdaoSupabase.js`:
- Added fetch for `health_referrals` with `receiving_office.eq.development`
- Mapped health referral fields to match expected structure
- Return `healthReferralsIncoming` array
- Added state and UI display in SDAO component

**Files:** 
- `src/services/sdaoSupabase.js` - lines 163-214
- `src/pages/SDAO/SDAO.jsx` - added `healthReferralsIncoming` state and display

### 4. **Missing State in SDAO Component**

**Root Cause:** SDAO page wasn't tracking or displaying incoming health referrals.

**Solution:** Updated `src/pages/SDAO/SDAO.jsx`:
- Added `healthReferralsIncoming` state variable
- Initialize in `refreshSdao` callback
- Display in new "Incoming from Health Services" table section

## Required Deployment Steps

### 1. Apply SQL Migration to Supabase

Run this migration in Supabase SQL Editor:

```sql
-- Add cross-office referral support to discipline_referrals table
alter table public.discipline_referrals
  add column if not exists referring_office text default 'discipline',
  add column if not exists target_office text;

create index if not exists discipline_referrals_target_office_idx
  on public.discipline_referrals (target_office)
  where target_office is not null;

create index if not exists discipline_referrals_referring_office_idx
  on public.discipline_referrals (referring_office);

create index if not exists discipline_referrals_offices_idx
  on public.discipline_referrals (referring_office, target_office);

notify pgrst, 'reload schema';
```

### 2. Deploy Code Changes

All code changes are in:
- `src/services/hsoSupabase.js` - HSO incoming SDAO referrals
- `src/services/sdaoSupabase.js` - SDAO incoming health referrals
- `src/pages/SDAO/SDAO.jsx` - SDAO UI for health referrals

### 3. Verify in Supabase Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Run: `SELECT * FROM discipline_referrals LIMIT 1;`
3. Verify columns: `referring_office`, `target_office` exist

### 4. Test Cross-Office Referrals

**Test Scenario 1: HSO → SDAO**
- Create referral in HSO to SDAO
- Check that it appears in SDAO "Incoming from Health Services"

**Test Scenario 2: DO → SDAO**
- Create referral in DO to SDAO  
- Check that it appears in SDAO "Incoming from Discipline Office"

**Test Scenario 3: DO → HSO**
- Create referral in DO to HSO
- Check that it appears in HSO incoming referrals

**Test Scenario 4: SDAO → HSO**
- Create referral in SDAO to HSO
- Check that it appears in HSO "Incoming from SDAO"

**Test Scenario 5: SDAO → DO**
- Create referral in SDAO to DO
- Check that it appears in DO incoming referrals from SDAO

## Files Modified

1. **supabase/migrations/20260514000000_discipline_referrals_cross_office.sql** (NEW)
   - Adds `referring_office` and `target_office` columns
   - Creates performance indexes
   - Reloads PostgREST schema cache

2. **src/services/hsoSupabase.js**
   - Updated `loadHsoFromSupabase()` to fetch SDAO referrals
   - Added SDAO referral mapping
   - Returns `sdaoReferralsIncoming`

3. **src/services/sdaoSupabase.js**
   - Updated `loadSdaoFromSupabase()` to fetch health referrals
   - Added health referral mapping
   - Returns `healthReferralsIncoming`

4. **src/pages/SDAO/SDAO.jsx**
   - Added `healthReferralsIncoming` state
   - Added health referrals display section in "Referrals" view
   - Maps HSO referrals with `healthIncoming: true` flag

## Notes

- All referral tables now support cross-office queries
- Schema cache is automatically reloaded via `notify pgrst, 'reload schema'`
- Referrals properly distinguish between referring and receiving offices
- UI now displays all incoming referrals from all partner offices
