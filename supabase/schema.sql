-- MHN Sales — Supabase schema
--
-- Pushing to GitHub deploys the website only — it does NOT update this database.
-- Run this (or sync_schema.sql) in: Supabase Dashboard → SQL Editor → Run
-- Safe to re-run.

create extension if not exists "pgcrypto";

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  company text not null default '',
  contact text default '',
  phone text default '',
  email text default '',
  industry text default '',
  tool text default '',
  value numeric not null default 10000,
  owner text default '',
  stage text not null default 'prospects',
  implementation_days integer,
  committed_at timestamptz,
  dismissed_at timestamptz,
  paused_at timestamptz,
  pinned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes jsonb not null default '[]'::jsonb
);

-- Columns added after the original launch
alter table public.deals
  add column if not exists board_order double precision;

alter table public.deals
  add column if not exists paused_at timestamptz;

alter table public.deals
  add column if not exists pinned_at timestamptz;

alter table public.deals
  add column if not exists tasks jsonb not null default '[]'::jsonb;

alter table public.deals
  add column if not exists interested_at timestamptz;

alter table public.deals
  add column if not exists committed_entered_at timestamptz;

alter table public.deals
  add column if not exists contract_name text default '';

alter table public.deals
  add column if not exists contract_file_path text default '';

alter table public.deals
  add column if not exists contract_file_name text default '';

-- Private bucket for contract files (PDF / Word)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contracts',
  'contracts',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can read contracts" on storage.objects;
create policy "Authenticated users can read contracts"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'contracts');

drop policy if exists "Authenticated users can upload contracts" on storage.objects;
create policy "Authenticated users can upload contracts"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'contracts');

drop policy if exists "Authenticated users can update contracts" on storage.objects;
create policy "Authenticated users can update contracts"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'contracts')
  with check (bucket_id = 'contracts');

drop policy if exists "Authenticated users can delete contracts" on storage.objects;
create policy "Authenticated users can delete contracts"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'contracts');

-- Optimistic concurrency: each successful write increments version
alter table public.deals
  add column if not exists version bigint not null default 1;

create index if not exists deals_stage_idx on public.deals (stage);
create index if not exists deals_owner_idx on public.deals (owner);
create index if not exists deals_board_order_idx on public.deals (stage, board_order);

alter table public.deals enable row level security;

drop policy if exists "Allow all access for personal use" on public.deals;
drop policy if exists "Authenticated users full access" on public.deals;
create policy "Authenticated users full access"
  on public.deals
  for all
  to authenticated
  using (true)
  with check (true);

-- Auth setup (Dashboard, not SQL):
-- 1) Authentication → Providers → Email → Enable
-- 2) Disable "Allow new users to sign up"; create teammate accounts in Authentication → Users
-- 3) Authentication → URL Configuration → add your GitHub Pages URL to Redirect URLs

do $$
begin
  alter publication supabase_realtime add table public.deals;
exception
  when duplicate_object then null;
end $$;

-- Knowledge tab: shared company reference rows
create table if not exists public.knowledge (
  id uuid primary key default gen_random_uuid(),
  web text not null default '',
  founded text not null default '',
  size text not null default '',
  valuation text not null default '',
  origin text not null default '',
  market text not null default '',
  owners text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge add column if not exists owners text not null default '';

alter table public.knowledge enable row level security;

drop policy if exists "Authenticated users full access" on public.knowledge;
create policy "Authenticated users full access"
  on public.knowledge
  for all
  to authenticated
  using (true)
  with check (true);

do $$
begin
  alter publication supabase_realtime add table public.knowledge;
exception
  when duplicate_object then null;
end $$;
