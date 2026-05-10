-- TV queue display kiosk: approve and set designation for a dedicated account.
-- Requires the user to exist in auth.users (create in Dashboard → Authentication → Users first).

update public.profiles p
set
  office = 'health',
  designation = 'queue_display',
  account_status = 'approved',
  role = coalesce(nullif(trim(p.role), ''), 'Staff')
from auth.users u
where p.id = u.id
  and lower(trim(u.email)) = lower(trim('hso.queue-display@gmail.com'));

notify pgrst, 'reload schema';
