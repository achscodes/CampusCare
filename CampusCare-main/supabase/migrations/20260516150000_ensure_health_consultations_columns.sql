-- Ensure health_consultations matches the HSO app + PostgREST expectations.
-- Fixes: "Could not find the 'student_name' column of 'health_consultations' in the schema cache"
-- when the live database was created from an older or partial schema.

alter table public.health_consultations
  add column if not exists student_name text,
  add column if not exists student_id text,
  add column if not exists visit_type text,
  add column if not exists visit_date date,
  add column if not exists visit_time text,
  add column if not exists chief_complaint text,
  add column if not exists consultation_service text,
  add column if not exists blood_pressure text,
  add column if not exists temperature_c text,
  add column if not exists heart_rate_bpm text,
  add column if not exists diagnosis text,
  add column if not exists treatment text,
  add column if not exists prescription_detail text,
  add column if not exists status text,
  add column if not exists attended_by text,
  add column if not exists medical_record_id uuid;

-- Legacy rows: fill display name when missing
update public.health_consultations
set student_name = 'Student ID ' || trim(student_id)
where (student_name is null or trim(student_name) = '')
  and student_id is not null
  and trim(student_id) <> '';

update public.health_consultations
set student_name = 'Unknown student'
where student_name is null
   or trim(student_name) = '';

notify pgrst, 'reload schema';
