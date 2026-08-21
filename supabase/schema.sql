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

-- Profile discovery is deliberately opt-in. No email is ever exposed to other users.
alter table public.training_profiles add column if not exists handle text unique;
alter table public.training_profiles add column if not exists bio text;
alter table public.training_profiles add column if not exists is_profile_public boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'training_profiles_handle_format') then
    alter table public.training_profiles add constraint training_profiles_handle_format check (handle is null or handle ~ '^[a-z0-9_]{3,24}$');
  end if;
end $$;

create table if not exists public.training_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);
create index if not exists training_friendships_requester_idx on public.training_friendships(requester_id, status);
create index if not exists training_friendships_addressee_idx on public.training_friendships(addressee_id, status);

alter table public.training_profiles enable row level security;
alter table public.training_programs enable row level security;
alter table public.training_program_state enable row level security;
alter table public.training_friendships enable row level security;

drop policy if exists "own profile" on public.training_profiles;
create policy "own profile" on public.training_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own programs" on public.training_programs;
create policy "own programs" on public.training_programs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own program state" on public.training_program_state;
create policy "own program state" on public.training_program_state for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own or public profiles" on public.training_profiles;
create policy "own or public profiles" on public.training_profiles for select using (
  auth.uid() = user_id or is_profile_public = true or exists (
    select 1 from public.training_friendships f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.addressee_id = training_profiles.user_id)
        or (f.addressee_id = auth.uid() and f.requester_id = training_profiles.user_id))
  )
);
drop policy if exists "manage own profile" on public.training_profiles;
create policy "manage own profile" on public.training_profiles for insert with check (auth.uid() = user_id);
drop policy if exists "update own profile" on public.training_profiles;
create policy "update own profile" on public.training_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "view own friendships" on public.training_friendships;
create policy "view own friendships" on public.training_friendships for select using (auth.uid() in (requester_id, addressee_id));
drop policy if exists "send friendship requests" on public.training_friendships;
create policy "send friendship requests" on public.training_friendships for insert with check (auth.uid() = requester_id);
drop policy if exists "respond to friendship requests" on public.training_friendships;
create policy "respond to friendship requests" on public.training_friendships for update using (auth.uid() = addressee_id) with check (auth.uid() = addressee_id);
drop policy if exists "cancel own friendship requests" on public.training_friendships;
create policy "cancel own friendship requests" on public.training_friendships for delete using (auth.uid() in (requester_id, addressee_id));

grant select, insert, update, delete on public.training_profiles to authenticated;
grant select, insert, update, delete on public.training_programs to authenticated;
grant select, insert, update, delete on public.training_program_state to authenticated;
grant select, insert, update, delete on public.training_friendships to authenticated;
