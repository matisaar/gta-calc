-- Run this in your Supabase project's SQL editor.
-- Stores manual tweaks to arrow midpoint positions (global / shared).

create table if not exists public.arrow_offsets (
  conn_id    text primary key,
  dx         double precision not null default 0,
  dy         double precision not null default 0,
  updated_at timestamptz       not null default now()
);

alter table public.arrow_offsets enable row level security;

-- Anonymous read + write (matches the "global shared layout" choice).
-- Tighten these later if you want auth-only writes.
drop policy if exists "anon read arrow_offsets"  on public.arrow_offsets;
drop policy if exists "anon write arrow_offsets" on public.arrow_offsets;

create policy "anon read arrow_offsets"
  on public.arrow_offsets for select
  using (true);

create policy "anon write arrow_offsets"
  on public.arrow_offsets for insert
  with check (true);

create policy "anon update arrow_offsets"
  on public.arrow_offsets for update
  using (true) with check (true);
