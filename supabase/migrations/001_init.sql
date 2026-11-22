-- PACEKIN core schema: profiles, official events, registrations, GPS runs, AI preferences.
create extension if not exists pgcrypto;

-- ---------- Profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  city text,
  date_of_birth date,
  experience_level text check (experience_level in ('Beginner','Intermediate','Advanced')),
  preferred_distance text,
  bio text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin insert into profiles (id) values (new.id) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users can never change their own role (PRD 2.1). Service-role / SQL editor (auth.uid() null) can.
create or replace function public.guard_profile_role() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Role changes are not permitted';
  end if;
  return new;
end $$;
create trigger trg_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();

alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid() and role = 'user');
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- Official events (admin-managed only) ----------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  description text,
  category text not null,
  distance_km numeric(6,2),
  difficulty text check (difficulty in ('Beginner','Intermediate','Advanced')),
  cover_url text,
  city text,
  meeting_point text,
  lat double precision,
  lng double precision,
  facilities text[] not null default '{}',
  starts_at timestamptz not null,
  reg_opens_at timestamptz,
  reg_closes_at timestamptz,
  ends_at timestamptz,
  capacity int not null check (capacity > 0),
  min_participants int,
  waitlist_enabled boolean not null default false,
  registered_count int not null default 0 check (registered_count >= 0),
  status text not null default 'draft' check (status in ('draft','published','unpublished','cancelled')),
  featured boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint capacity_not_exceeded check (registered_count <= capacity)
);
create index events_status_start_idx on public.events (status, starts_at);

create table public.event_audit (
  id bigint generated always as identity primary key,
  event_id uuid,
  actor_id uuid default auth.uid(),
  action text not null,
  changes jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.audit_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into event_audit (event_id, action, changes)
  values (coalesce(new.id, old.id), tg_op,
          jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)));
  return coalesce(new, old);
end $$;
create trigger trg_audit_events after insert or update or delete on public.events
  for each row execute function public.audit_event();

alter table public.events enable row level security;
alter table public.event_audit enable row level security;
create policy events_read_published on public.events for select to authenticated
  using (status = 'published' or public.is_admin());
create policy events_admin_insert on public.events for insert to authenticated with check (public.is_admin());
create policy events_admin_update on public.events for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy events_admin_delete on public.events for delete to authenticated using (public.is_admin());
create policy audit_admin_read on public.event_audit for select to authenticated using (public.is_admin());
-- No insert/update/delete policy for normal users on events => rejected by RLS.

-- ---------- Registrations ----------
create table public.event_registrations (
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'confirmed' check (status in ('confirmed','waitlisted','cancelled')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_registrations enable row level security;
create policy reg_select_own on public.event_registrations for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create or replace function public.join_event(p_event uuid) returns text
language plpgsql security definer set search_path = public as $$
declare e events%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into e from events where id = p_event and status = 'published' for update;
  if not found then raise exception 'Event is not available'; end if;
  if now() < coalesce(e.reg_opens_at, '-infinity') or now() > coalesce(e.reg_closes_at, e.starts_at) then
    raise exception 'Registration is closed';
  end if;
  if exists (select 1 from event_registrations where event_id = p_event and user_id = auth.uid() and status = 'confirmed') then
    return 'already_joined';
  end if;
  if e.registered_count >= e.capacity then raise exception 'Event is full'; end if;
  insert into event_registrations (event_id, user_id) values (p_event, auth.uid())
    on conflict (event_id, user_id) do update set status = 'confirmed';
  update events set registered_count = registered_count + 1, updated_at = now() where id = p_event;
  return 'joined';
end $$;

create or replace function public.leave_event(p_event uuid) returns text
language plpgsql security definer set search_path = public as $$
declare e events%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into e from events where id = p_event for update;
  if not found then raise exception 'Event not found'; end if;
  if now() > coalesce(e.reg_closes_at, e.starts_at) then raise exception 'Cancellation window has closed'; end if;
  update event_registrations set status = 'cancelled'
    where event_id = p_event and user_id = auth.uid() and status = 'confirmed';
  if found then
    update events set registered_count = greatest(registered_count - 1, 0), updated_at = now() where id = p_event;
  end if;
  return 'left';
end $$;

-- Service-role only: used by account deletion to keep counts accurate.
create or replace function public.adjust_registered_count(p_event uuid, p_delta int) returns void
language sql security definer set search_path = public as $$
  update events set registered_count = greatest(registered_count + p_delta, 0) where id = p_event;
$$;
revoke execute on function public.adjust_registered_count(uuid, int) from public, anon, authenticated;
grant execute on function public.adjust_registered_count(uuid, int) to service_role;

revoke execute on function public.join_event(uuid) from public, anon;
revoke execute on function public.leave_event(uuid) from public, anon;
grant execute on function public.join_event(uuid) to authenticated;
grant execute on function public.leave_event(uuid) to authenticated;

-- ---------- GPS runs ----------
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  source text not null default 'gps' check (source in ('gps','manual')),
  verified boolean not null default false,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  distance_m int not null check (distance_m >= 0),
  duration_s int not null check (duration_s >= 0),
  created_at timestamptz not null default now(),
  constraint runs_unique_start unique (user_id, started_at)
);

create table public.run_routes (
  run_id uuid primary key references runs(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  points jsonb not null
);

create or replace function public.prepare_run() returns trigger
language plpgsql as $$
begin
  new.user_id := auth.uid();
  -- Verified only for GPS runs with plausible average speed (<= 11 m/s).
  new.verified := new.source = 'gps' and new.duration_s > 0
                  and (new.distance_m::numeric / new.duration_s) <= 11;
  return new;
end $$;
create trigger trg_prepare_run before insert on public.runs
  for each row execute function public.prepare_run();

alter table public.runs enable row level security;
alter table public.run_routes enable row level security;
create policy runs_select_own on public.runs for select to authenticated using (user_id = auth.uid());
create policy runs_insert_own on public.runs for insert to authenticated with check (user_id = auth.uid());
create policy runs_delete_own on public.runs for delete to authenticated using (user_id = auth.uid());
create policy routes_select_own on public.run_routes for select to authenticated using (user_id = auth.uid());
create policy routes_insert_own on public.run_routes for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from runs r where r.id = run_id and r.user_id = auth.uid()));
create policy routes_delete_own on public.run_routes for delete to authenticated using (user_id = auth.uid());

-- ---------- AI Coach preferences (no chat history stored in this release) ----------
create table public.ai_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  enabled boolean not null default false,
  personalization_consent boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.ai_preferences enable row level security;
create policy ai_prefs_own on public.ai_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Admin bootstrap (run once in SQL editor, never from the app):
-- update public.profiles set role = 'admin' where id = '<owner-user-uuid>';
