-- Structured physician chart (per-field text) as JSON; legacy text columns remain for older rows.

alter table public.medical_records
  add column if not exists physician_medical_history_json jsonb not null default '{}'::jsonb,
  add column if not exists physician_physical_examination_json jsonb not null default '{}'::jsonb;

comment on column public.medical_records.physician_medical_history_json is 'Keyed physician medical history lines (allergy, asthma, etc.).';
comment on column public.medical_records.physician_physical_examination_json is 'Keyed PE lines (skin, eyes OD/OS, vitals from nurse are not stored here).';

notify pgrst, 'reload schema';
