-- Physician chart fields, consultation certificate/prescription columns, student demographics for read-only chart header.

alter table public.medical_records
  add column if not exists physician_medical_history text,
  add column if not exists physician_physical_examination text,
  add column if not exists physician_prescription_notes text,
  add column if not exists physician_documents_notes text;

alter table public.health_consultations
  add column if not exists certificate_reason text,
  add column if not exists certificate_period text,
  add column if not exists certificate_status text default 'issued',
  add column if not exists prescription_detail text;

comment on column public.medical_records.physician_medical_history is 'Physician-editable; personal demographics live on students / mobile.';
comment on column public.health_consultations.certificate_reason is 'Non-null implies a medical certificate was issued for this visit row.';
comment on column public.health_consultations.prescription_detail is 'Medication orders; distinct from legacy treatment text if both set.';

alter table public.students
  add column if not exists course text,
  add column if not exists year_level text,
  add column if not exists address text,
  add column if not exists contact_no text,
  add column if not exists birthdate date,
  add column if not exists age text,
  add column if not exists sex text,
  add column if not exists marital_status text,
  add column if not exists religion text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_relationship text,
  add column if not exists emergency_contact_no text,
  add column if not exists nationality text,
  add column if not exists middle_initial text;

notify pgrst, 'reload schema';
