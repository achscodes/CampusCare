-- Staff rejection text for student email / mobile outcome (not shown on DO list table).
alter table public.discipline_incident_reports
  add column if not exists rejection_message text;

comment on column public.discipline_incident_reports.rejection_message is
  'DO rejection explanation (quick reasons + detail). Used for student email/notification; not displayed on staff incident table.';
