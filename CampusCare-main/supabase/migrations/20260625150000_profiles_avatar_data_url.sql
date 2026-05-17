-- Optional profile photo as data URL (cropped in-app). Staff-owned; admins read via existing profiles SELECT policies.

alter table public.profiles
  add column if not exists avatar_data_url text;

alter table public.profiles
  drop constraint if exists profiles_avatar_data_url_len_check;

alter table public.profiles
  add constraint profiles_avatar_data_url_len_check
  check (avatar_data_url is null or char_length(avatar_data_url) <= 600000);

comment on column public.profiles.avatar_data_url is
  'Optional data:image/… URL for header avatar; persisted so it survives logout and appears in admin user lists.';
