-- ============================================================================
-- Drop the email allowlist. The service is open to anyone with a Google
-- account; new sign-ups still mirror their profile into public.users.
-- ============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
    set email        = excluded.email,
        display_name = excluded.display_name,
        avatar_url   = excluded.avatar_url;

  return new;
end;
$$;

-- The allowlist table is no longer referenced. Drop it so it can't drift.
drop table if exists public.allowed_emails;
