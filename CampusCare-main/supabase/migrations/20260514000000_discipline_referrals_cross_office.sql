-- Add cross-office referral support to discipline_referrals table
-- This migration adds referring_office and target_office columns to support
-- referrals between DO, HSO, and SDAO

-- Add missing columns to discipline_referrals
alter table public.discipline_referrals
  add column if not exists referring_office text default 'discipline',
  add column if not exists target_office text;

-- Add index for target_office to speed up filtering
create index if not exists discipline_referrals_target_office_idx
  on public.discipline_referrals (target_office)
  where target_office is not null;

-- Add index for referring_office
create index if not exists discipline_referrals_referring_office_idx
  on public.discipline_referrals (referring_office);

-- Update existing rows to have proper office keys
update public.discipline_referrals
set referring_office = 'discipline'
where referring_office is null or referring_office = '';

-- Create index for filtering referrals by both offices
create index if not exists discipline_referrals_offices_idx
  on public.discipline_referrals (referring_office, target_office);

-- Refresh schema cache
notify pgrst, 'reload schema';
