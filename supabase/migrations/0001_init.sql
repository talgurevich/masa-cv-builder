-- ============================================================================
-- masa-cv-builder — initial schema
-- Run this migration in the Supabase SQL Editor (or via `supabase db push`).
-- ============================================================================

-- ─── extensions ─────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── public.users (mirror of auth.users) ────────────────────────────────────
-- Supabase Auth manages auth.users. We mirror the bits we want to query
-- into a public table that's safe to JOIN from RLS-bound queries.
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now()
);

-- ─── allowlist (gate at signup) ─────────────────────────────────────────────
create table if not exists public.allowed_emails (
  email      text primary key,
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  notes      text
);

comment on table public.allowed_emails is
  'Only emails listed here can sign in. Insert a row to invite a user.';

-- ─── trigger: enforce allowlist + mirror profile into public.users ─────────
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.allowed_emails where email = new.email) then
    raise exception 'email % is not in the allowlist', new.email
      using errcode = '42501';  -- insufficient_privilege
  end if;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ─── cvs ────────────────────────────────────────────────────────────────────
create table if not exists public.cvs (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references public.users(id) on delete cascade,
  title            text not null default 'קורות חיים',
  data             jsonb not null default '{}'::jsonb,
  status           text not null default 'draft'
                   check (status in ('draft', 'complete', 'tuned')),
  job_description  text,
  job_keywords     text[],
  pdf_path         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists cvs_user_updated_idx
  on public.cvs (user_id, updated_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cvs_touch_updated_at on public.cvs;
create trigger cvs_touch_updated_at
  before update on public.cvs
  for each row execute function public.touch_updated_at();

-- ─── messages ───────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id          uuid primary key default uuid_generate_v4(),
  cv_id       uuid not null references public.cvs(id) on delete cascade,
  role        text not null check (role in ('system', 'user', 'assistant', 'tool')),
  content     jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists messages_cv_created_idx
  on public.messages (cv_id, created_at);

-- ─── Row Level Security ─────────────────────────────────────────────────────
alter table public.users          enable row level security;
alter table public.cvs            enable row level security;
alter table public.messages       enable row level security;
alter table public.allowed_emails enable row level security;

-- users: a user can read/update only their own profile
drop policy if exists "users self read"   on public.users;
drop policy if exists "users self update" on public.users;
create policy "users self read"
  on public.users for select using (auth.uid() = id);
create policy "users self update"
  on public.users for update using (auth.uid() = id);

-- cvs: a user can CRUD only their own CVs
drop policy if exists "cvs owner all" on public.cvs;
create policy "cvs owner all"
  on public.cvs for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- messages: scoped via cv_id → cvs.user_id
drop policy if exists "messages owner all" on public.messages;
create policy "messages owner all"
  on public.messages for all
  using (
    exists (
      select 1 from public.cvs
      where cvs.id = messages.cv_id and cvs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cvs
      where cvs.id = messages.cv_id and cvs.user_id = auth.uid()
    )
  );

-- allowed_emails: nobody reads this table from the browser; service role only.
-- (No SELECT policy → all SELECTs from authenticated/anon roles are blocked.)

-- ─── Storage bucket for generated PDFs ──────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('cv-pdfs', 'cv-pdfs', false)
on conflict (id) do nothing;

-- Users can read only PDFs whose path starts with their user-id folder.
drop policy if exists "cv-pdfs read own" on storage.objects;
create policy "cv-pdfs read own"
  on storage.objects for select
  using (
    bucket_id = 'cv-pdfs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- The server's service-role key bypasses RLS for uploads, so no INSERT policy
-- is needed for anon/authenticated.
