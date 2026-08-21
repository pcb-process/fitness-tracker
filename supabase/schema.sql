-- HYBRID // TRAIN cloud data model. Run this once in Supabase SQL Editor.
create table if not exists public.training_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_start_date date not null default current_date,
  active_program_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  goal text,
  start_date date not null default current_date,
  program_data jsonb not null default '{}'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists training_programs_user_id_idx on public.training_programs(user_id, archived, created_at desc);

-- One cloud state document per program. program_data holds the editable plan;
-- state_data holds completed sessions, set logs, running logs, and measurements.
create table if not exists public.training_program_state (
  program_id uuid primary key references public.training_programs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  state_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists training_program_state_user_id_idx on public.training_program_state(user_id);

alter table public.training_profiles enable row level security;
alter table public.training_programs enable row level security;
alter table public.training_program_state enable row level security;

drop policy if exists "own profile" on public.training_profiles;
create policy "own profile" on public.training_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own programs" on public.training_programs;
create policy "own programs" on public.training_programs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own program state" on public.training_program_state;
create policy "own program state" on public.training_program_state for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.training_profiles to authenticated;
grant select, insert, update, delete on public.training_programs to authenticated;
grant select, insert, update, delete on public.training_program_state to authenticated;
