-- V2 AI & Admin Migration
-- Adds: admin role, encrypted API key storage, admin exercise RLS
-- Safe to run on existing database. Does not modify/delete existing data.

-- ---------------------------------------------------------------------------
-- 1. Add role to profiles
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

-- ---------------------------------------------------------------------------
-- 2. Set initial admin (charles.camisasca@gmail.com)
-- ---------------------------------------------------------------------------

update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'charles.camisasca@gmail.com' limit 1
);

-- ---------------------------------------------------------------------------
-- 3. User API keys table (encrypted key storage)
-- ---------------------------------------------------------------------------

create table if not exists public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'openai',
  encrypted_key text not null,
  key_hint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists user_api_keys_user_provider_idx
  on public.user_api_keys (user_id, provider);

drop trigger if exists user_api_keys_set_updated_at on public.user_api_keys;
create trigger user_api_keys_set_updated_at
  before update on public.user_api_keys
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. User API keys RLS
-- ---------------------------------------------------------------------------

alter table public.user_api_keys enable row level security;

drop policy if exists "Users can view own api keys" on public.user_api_keys;
create policy "Users can view own api keys"
  on public.user_api_keys for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own api keys" on public.user_api_keys;
create policy "Users can insert own api keys"
  on public.user_api_keys for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update own api keys" on public.user_api_keys;
create policy "Users can update own api keys"
  on public.user_api_keys for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own api keys" on public.user_api_keys;
create policy "Users can delete own api keys"
  on public.user_api_keys for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.user_api_keys to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Admin RLS for exercise_library (global exercise management)
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can insert global exercises" on public.exercise_library;
create policy "Admins can insert global exercises"
  on public.exercise_library for insert
  with check (
    is_system_exercise = true
    and user_id is null
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Admins can update global exercises" on public.exercise_library;
create policy "Admins can update global exercises"
  on public.exercise_library for update
  using (
    is_system_exercise = true
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    is_system_exercise = true
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Admins can delete global exercises" on public.exercise_library;
create policy "Admins can delete global exercises"
  on public.exercise_library for delete
  using (
    is_system_exercise = true
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Helper function: check if current user is admin
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;
