-- Premi & Solar — Supabase schema + RLS (idempotent)
-- Jalankan di SQL Editor Supabase (atau supabase db push).
-- Setelah migrasi: buat user lewat Authentication, lalu misalnya:
--   update public.profiles set role = 'ADMIN_PUSAT', branch_id = null where email = 'email@pusat.com';

-- 1) create extension
create extension if not exists "pgcrypto";

-- 2) create branches table
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  created_at timestamptz not null default now()
);

-- 3) create profiles table (HARUS sebelum fungsi/trigger/policy yang refer public.profiles)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'ADMIN_CABANG' check (role in ('ADMIN_PUSAT', 'ADMIN_CABANG')),
  branch_id uuid references public.branches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) create personil table
create table if not exists public.personil (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete cascade,
  nama_sopir text not null,
  status_sopir text not null,
  status_aktif text not null,
  created_at timestamptz not null default now()
);

create index if not exists personil_branch_idx on public.personil (branch_id);

-- 5) create kendaraan table
create table if not exists public.kendaraan (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete cascade,
  jenis_kendaraan text not null,
  plat_nomor text not null,
  status_aktif text not null,
  created_at timestamptz not null default now()
);

create index if not exists kendaraan_branch_idx on public.kendaraan (branch_id);

-- 6) create transactions table
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete cascade,
  tanggal text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists transactions_branch_tanggal_idx on public.transactions (branch_id, tanggal desc);

-- 7) create app_settings table
create table if not exists public.app_settings (
  id text primary key default 'global',
  branch_id uuid references public.branches (id),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, branch_id, settings)
values ('global', null, '{}'::jsonb)
on conflict (id) do nothing;

-- 8) create functions
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_branch uuid;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'ADMIN_CABANG');
  if v_role not in ('ADMIN_PUSAT', 'ADMIN_CABANG') then
    v_role := 'ADMIN_CABANG';
  end if;

  begin
    if new.raw_user_meta_data->>'branch_id' is not null
       and length(trim(new.raw_user_meta_data->>'branch_id')) >= 32 then
      v_branch := (new.raw_user_meta_data->>'branch_id')::uuid;
    end if;
  exception when others then
    v_branch := null;
  end;

  insert into public.profiles (id, email, full_name, role, branch_id)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    v_role,
    v_branch
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    branch_id = excluded.branch_id,
    updated_at = now();

  return new;
end;
$$;

-- 9) create triggers
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user ();

-- 10) enable RLS
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.personil enable row level security;
alter table public.kendaraan enable row level security;
alter table public.transactions enable row level security;
alter table public.app_settings enable row level security;

-- 11) create RLS policies (drop dulu supaya idempotent)

-- branches
drop policy if exists "branches_select_auth" on public.branches;
create policy "branches_select_auth"
  on public.branches for select
  to authenticated
  using (true);

drop policy if exists "branches_write_pusat" on public.branches;
create policy "branches_write_pusat"
  on public.branches for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_PUSAT')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_PUSAT')
  );

-- profiles
drop policy if exists "profiles_select_own_or_pusat" on public.profiles;
create policy "profiles_select_own_or_pusat"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_PUSAT')
  );

drop policy if exists "profiles_update_own_cabang" on public.profiles;
create policy "profiles_update_own_cabang"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_update_pusat" on public.profiles;
create policy "profiles_update_pusat"
  on public.profiles for update
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_PUSAT')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_PUSAT')
  );

-- personil
drop policy if exists "personil_select" on public.personil;
create policy "personil_select"
  on public.personil for select
  to authenticated
  using (true); -- semua akun dapat melihat semua personil (global)

drop policy if exists "personil_insert" on public.personil;
create policy "personil_insert"
  on public.personil for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_PUSAT')
    or branch_id = (select p.branch_id from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_CABANG')
  );

drop policy if exists "personil_update" on public.personil;
create policy "personil_update"
  on public.personil for update
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_PUSAT')
    or branch_id = (select p.branch_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists "personil_delete" on public.personil;
create policy "personil_delete"
  on public.personil for delete
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_PUSAT')
    or branch_id = (select p.branch_id from public.profiles p where p.id = auth.uid())
  );

-- kendaraan
drop policy if exists "kendaraan_select" on public.kendaraan;
create policy "kendaraan_select"
  on public.kendaraan for select
  to authenticated
  using (true); -- semua akun dapat melihat semua kendaraan (global)

drop policy if exists "kendaraan_insert" on public.kendaraan;
create policy "kendaraan_insert"
  on public.kendaraan for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_PUSAT')
    or branch_id = (select p.branch_id from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_CABANG')
  );

drop policy if exists "kendaraan_update" on public.kendaraan;
create policy "kendaraan_update"
  on public.kendaraan for update
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_PUSAT')
    or branch_id = (select p.branch_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists "kendaraan_delete" on public.kendaraan;
create policy "kendaraan_delete"
  on public.kendaraan for delete
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_PUSAT')
    or branch_id = (select p.branch_id from public.profiles p where p.id = auth.uid())
  );

-- transactions
drop policy if exists "transactions_select" on public.transactions;
create policy "transactions_select"
  on public.transactions for select
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_PUSAT')
    or branch_id = (select p.branch_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists "transactions_insert" on public.transactions;
create policy "transactions_insert"
  on public.transactions for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_PUSAT')
    or branch_id = (select p.branch_id from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_CABANG')
  );

drop policy if exists "transactions_update" on public.transactions;
create policy "transactions_update"
  on public.transactions for update
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_PUSAT')
    or branch_id = (select p.branch_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists "transactions_delete" on public.transactions;
create policy "transactions_delete"
  on public.transactions for delete
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_PUSAT')
    or branch_id = (select p.branch_id from public.profiles p where p.id = auth.uid())
  );

-- app_settings
drop policy if exists "app_settings_select" on public.app_settings;
create policy "app_settings_select"
  on public.app_settings for select
  to authenticated
  using (true);

drop policy if exists "app_settings_write_pusat" on public.app_settings;
create policy "app_settings_write_pusat"
  on public.app_settings for update
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_PUSAT')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN_PUSAT')
  );
