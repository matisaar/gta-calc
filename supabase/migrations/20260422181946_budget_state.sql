create table if not exists public.budget_state (
  ckey       text not null,
  fam        boolean not null,
  state      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (ckey, fam)
);

alter table public.budget_state enable row level security;

drop policy if exists "anon read budget_state"   on public.budget_state;
drop policy if exists "anon insert budget_state" on public.budget_state;
drop policy if exists "anon update budget_state" on public.budget_state;

create policy "anon read budget_state"   on public.budget_state for select using (true);
create policy "anon insert budget_state" on public.budget_state for insert with check (true);
create policy "anon update budget_state" on public.budget_state for update using (true) with check (true);
