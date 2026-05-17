# SDAO→HSO Referral Visibility Fix

**Issue:** Referrals created from SDAO (Student Development Affairs Office) to HSO (Health Services Office) were not showing up for HSO staff.

**Root Cause:** RLS (Row Level Security) policy was failing to match office values between the profiles table and the referrals table due to type mismatches and office value inconsistencies.

## Solution Applied

### 1. New Migration: `20260513000002_fix_referral_visibility.sql`

This migration includes:

#### A. Standardize Office Values
```sql
-- Normalize office values to match welfare_office enum
-- health, sdao, discipline, counseling
```

#### B. Simplified RLS Policies
Created new, more reliable policies using helper functions:
- `get_user_office()` - Returns user's office as welfare_office enum
- `is_staff()` - Checks if user is staff
- New policies with clearer conditions

#### C. New Views for Office Staff
- `hso_incoming_referrals` - HSO can see all referrals TO health
- `sdao_outgoing_referrals` - SDAO can see all referrals FROM sdao

#### D. Test Function
- `test_sdao_hso_referral_visibility()` - Verify the fix works

### 2. Updated Service Layer

New methods in `referralService`:
```typescript
// Get incoming referrals for HSO
getHSOIncomingReferrals(supabase)

// Get outgoing referrals for SDAO
getSDAOOutgoingReferrals(supabase)

// Get referrals by office and direction
getOfficeReferrals(supabase, office, direction)

// Debug visibility issues
debugReferralVisibility(supabase)
```

### 3. Updated React Hook

New methods in `useDataInterconnection`:
```typescript
const {
  getHSOIncomingReferrals,   // NEW
  getSDAOOutgoingReferrals,  // NEW
  debugReferralVisibility,   // NEW
} = useDataInterconnection();
```

## How to Apply the Fix

### Step 1: Apply Migration
```bash
# In Supabase SQL Editor, run:
# supabase/migrations/20260513000002_fix_referral_visibility.sql
```

### Step 2: Verify Installation
```sql
-- Check new views exist
SELECT * FROM hso_incoming_referrals LIMIT 1;
SELECT * FROM sdao_outgoing_referrals LIMIT 1;

-- Run test
SELECT * FROM test_sdao_hso_referral_visibility();
```

### Step 3: Update Components

**For HSO Staff Dashboard:**
```typescript
import { useDataInterconnection } from '@/lib/hooks/useDataInterconnection';

export default function HSOReferralList() {
  const { getHSOIncomingReferrals, loading } = useDataInterconnection();
  
  useEffect(() => {
    getHSOIncomingReferrals().then(referrals => {
      console.log('Incoming referrals:', referrals);
    });
  }, []);
}
```

**For SDAO Staff Dashboard:**
```typescript
export default function SDAOReferralList() {
  const { getSDAOOutgoingReferrals, loading } = useDataInterconnection();
  
  useEffect(() => {
    getSDAOOutgoingReferrals().then(referrals => {
      console.log('Outgoing referrals:', referrals);
    });
  }, []);
}
```

## Troubleshooting

### HSO Still Can't See Referrals?

**Option 1: Use Debug Function**
```typescript
const { debugReferralVisibility } = useDataInterconnection();

const debug = await debugReferralVisibility();
console.log(debug);
// Output shows:
// - User's office
// - User's role
// - All visible referrals
// - Diagnostics
```

**Option 2: Check Manually**
```sql
-- Check HSO staff profile
SELECT id, first_name, office, role FROM profiles WHERE office = 'health';

-- Check referrals TO health
SELECT id, reference_id, from_service, to_service, status 
FROM referrals 
WHERE to_service = 'health';

-- Verify HSO staff can see these referrals
-- (You won't see all if RLS is working correctly)
```

**Option 3: Verify Views Work**
```sql
SELECT * FROM hso_incoming_referrals;
```

### Fix Not Working?

1. **Clear RLS Policies:**
   - Ensure ALL old policies were dropped
   - Migration includes: `DROP POLICY IF EXISTS ...`

2. **Check Office Values:**
   ```sql
   SELECT DISTINCT office FROM profiles;
   -- Should show: health, sdao, discipline, counseling
   ```

3. **Verify Enum Types:**
   ```sql
   SELECT * FROM pg_enum WHERE typname = 'welfare_office';
   ```

4. **Test Helper Functions:**
   ```sql
   -- As HSO staff user
   SELECT public.get_user_office();
   SELECT public.is_staff();
   ```

## Data Flow After Fix

```
SDAO Staff Creates Referral
    ↓
to_service = 'health' (HSO)
from_service = 'sdao' (SDAO)
    ↓
Stored in public.referrals table
    ↓
RLS Policy Checks:
  - HSO staff: to_service = 'health' ✓
  - SDAO staff: from_service = 'sdao' ✓
    ↓
Visible in:
  - hso_incoming_referrals (for HSO)
  - sdao_outgoing_referrals (for SDAO)
    ↓
Fetched via:
  - getHSOIncomingReferrals() (HSO UI)
  - getSDAOOutgoingReferrals() (SDAO UI)
```

## Testing Steps

### Test 1: Create a Referral
```typescript
const referral = await createCrossOfficeReferral(
  studentId,
  'sdao',    // FROM
  'health',  // TO
  'Mental health assessment needed',
  'normal'
);
console.log('Created:', referral.reference_number);
```

### Test 2: Check HSO Visibility
```typescript
// As HSO staff
const incomingReferrals = await getHSOIncomingReferrals();
console.log('HSO can see:', incomingReferrals.length, 'referrals');
// Should include the referral created in Test 1
```

### Test 3: Check SDAO Visibility
```typescript
// As SDAO staff
const outgoingReferrals = await getSDAOOutgoingReferrals();
console.log('SDAO can see:', outgoingReferrals.length, 'referrals');
// Should include the referral created in Test 1
```

## Performance Notes

- New views use indexes for fast queries
- RLS policies now use simpler conditions
- Helper functions cached by PostgreSQL
- No N+1 queries

## Files Changed

1. ✅ `supabase/migrations/20260513000002_fix_referral_visibility.sql` (NEW)
2. ✅ `lib/data-interconnection.service.ts` (UPDATED)
3. ✅ `lib/hooks/useDataInterconnection.ts` (UPDATED)

## Next Steps

1. Apply migration
2. Test with debug function
3. Update component UI to use new methods
4. Monitor referral flow
5. Train staff on new system

## Support

For issues:
1. Run `debugReferralVisibility()` to diagnose
2. Check migration applied: `SELECT * FROM hso_incoming_referrals LIMIT 1;`
3. Verify office values: `SELECT DISTINCT office FROM profiles;`
4. Test RLS: `SELECT public.get_user_office();`
