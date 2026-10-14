create function public.validate_timezone() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone'; end if;
  return new;
end;
$$;
create trigger validate_profile_timezone before insert or update on public.profiles for each row execute procedure public.validate_timezone();
create function public.validate_log() returns trigger language plpgsql security invoker set search_path='' as $$
declare t public.trackers; tz text;
begin
  select * into t from public.trackers where id=new.tracker_id and user_id=new.user_id and archived_at is null for update;
  if not found then raise exception 'Tracker unavailable' using errcode='42501'; end if;
  select timezone into tz from public.profiles where id=new.user_id;
  if new.tracking_date > (now() at time zone tz)::date or new.tracking_date < (t.created_at at time zone tz)::date then raise exception 'Date outside tracker history'; end if;
  if not extract(dow from new.tracking_date)::integer=any(t.schedule) then raise exception 'Tracker not scheduled on that date'; end if;
  return new;
end;
$$;
create trigger validate_tracker_log before insert or update on public.tracker_logs for each row execute procedure public.validate_log();
revoke all on function public.validate_log() from public,anon,authenticated;
revoke all on function public.validate_timezone() from public,anon,authenticated;
