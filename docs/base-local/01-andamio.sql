do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login;  -- sin contrasena: el pg_hba local es trust
  end if;
end
$roles$;
grant anon, authenticated, service_role to authenticator;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

create extension if not exists pgcrypto with schema public;
create extension if not exists pg_trgm with schema public;
create extension if not exists unaccent with schema public;

-- auth.users: solo las columnas que el proyecto toca
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid default '00000000-0000-0000-0000-000000000000',
  aud text default 'authenticated',
  role text default 'authenticated',
  email text unique,
  email_confirmed_at timestamptz,
  encrypted_password text,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  is_super_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_sign_in_at timestamptz,
  phone text,
  confirmed_at timestamptz
);

create table auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table auth.audit_log_entries (
  id uuid primary key default gen_random_uuid(),
  payload json,
  created_at timestamptz default now()
);

-- auth.uid() lee el reclamo "sub" del JWT, igual que en Supabase
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ), '')::uuid
$$;

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(
    current_setting('request.jwt.claim.role', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )
$$;

create or replace function auth.email() returns text language sql stable as $$
  select coalesce(
    current_setting('request.jwt.claim.email', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )
$$;

-- storage: lo minimo para los adjuntos
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text, owner uuid, metadata jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

grant usage on schema auth, storage, public to anon, authenticated, service_role;
grant select on auth.users, auth.sessions to authenticated, service_role;
alter default privileges in schema public grant all on tables to service_role;
