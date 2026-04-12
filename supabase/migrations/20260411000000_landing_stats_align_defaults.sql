-- Align landing_stats with live product defaults (replaces older demo seed 100/100/12).
-- monthly_visits is left unchanged so it continues to reflect whatever you store (analytics / manual).
-- Edit office_staff below if your registered staff count differs before running.

update public.landing_stats
set
  active_students = 0,
  office_staff = 3,
  updated_at = now()
where id = 1;
