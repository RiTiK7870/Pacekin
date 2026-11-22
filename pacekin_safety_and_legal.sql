-- =============================================================================
-- PACEKIN: automated screening, login bans for suspensions, safe system updates
-- Run ONCE in the Supabase SQL editor (after pacekin_paid_and_notifications.sql).
-- =============================================================================
begin;

-- 0. Retire the old push job (push isn't used any more)
do $$ begin perform cron.unschedule('pacekin-push'); exception when others then null; end $$;

-- 1. Config for calling edge functions from the database (set the values after running)
insert into public.app_config (key, value, description) values
  ('functions.base_url', '"https://YOUR-PROJECT-REF.supabase.co/functions/v1"', 'Edge functions base URL'),
  ('functions.anon_key', '"YOUR-ANON-KEY"', 'Anon key for internal function calls'),
  ('moderation.enabled', 'true', 'Automated content screening on/off')
on conflict (key) do nothing;

-- 2. Fix: system work (account deletion, moderation) must not be blocked by the message guard.
--    Without this, deleting an account that has sent messages would fail.
create or replace function public.guard_message_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- system, service role, account deletion
  if public.is_staff() then return new; end if;
  if old.sender_id is distinct from auth.uid() then raise exception 'Not allowed'; end if;
  if new.conversation_id <> old.conversation_id or new.sender_id is distinct from old.sender_id
     or new.moderation_status <> old.moderation_status or new.pinned_at is distinct from old.pinned_at then
    raise exception 'Not allowed';
  end if;
  if old.created_at < now() - make_interval(mins => public.cfg_int('chat.edit_window_minutes', 15)) then
    raise exception 'Edit window has closed';
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    new.body := '[deleted]'; new.attachment_id := null; new.edited_at := null;
  elsif new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end $$;

-- 3. Call an edge function without ever blocking the user's action
create or replace function public.call_edge_function(p_path text, p_body jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare base text; key text;
begin
  base := (select value #>> '{}' from public.app_config where key = 'functions.base_url');
  key  := (select value #>> '{}' from public.app_config where key = 'functions.anon_key');
  if base is null or key is null or base like 'https://YOUR-%' or key = 'YOUR-ANON-KEY' then return; end if;
  perform net.http_post(
    url := base || p_path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || key, 'Content-Type', 'application/json'),
    body := p_body,
    timeout_milliseconds := 5000);
exception when others then
  null;
end $$;

-- 4. Screen new messages
create or replace function public.trg_screen_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce((select (value #>> '{}')::boolean from public.app_config where key = 'moderation.enabled'), true) then
    perform public.call_edge_function('/moderate-text',
      jsonb_build_object('target_type', 'message', 'target_id', new.id::text));
  end if;
  return new;
end $$;

drop trigger if exists trg_screen_message on public.messages;
create trigger trg_screen_message after insert on public.messages
  for each row when (new.body is not null)
  execute function public.trg_screen_message();

-- 5. Screen profile bios when they change
create or replace function public.trg_screen_bio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce((select (value #>> '{}')::boolean from public.app_config where key = 'moderation.enabled'), true) then
    perform public.call_edge_function('/moderate-text',
      jsonb_build_object('target_type', 'profile_bio', 'target_id', new.id::text));
  end if;
  return new;
end $$;

drop trigger if exists trg_screen_bio on public.profiles;
create trigger trg_screen_bio after update of bio on public.profiles
  for each row when (new.bio is not null and new.bio is distinct from old.bio)
  execute function public.trg_screen_bio();

-- 6. Suspensions also ban the login (and lift the ban when a suspension is removed)
create or replace function public.trg_sync_ban() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid; kind text;
begin
  if tg_op = 'DELETE' then uid := old.user_id; kind := old.restriction;
  else uid := new.user_id; kind := new.restriction; end if;
  if kind = 'account' then
    perform public.call_edge_function('/sync-bans', jsonb_build_object('user_id', uid::text));
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists trg_sync_ban on public.account_restrictions;
create trigger trg_sync_ban after insert or delete on public.account_restrictions
  for each row execute function public.trg_sync_ban();

commit;
