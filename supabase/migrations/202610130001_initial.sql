create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);
create table public.themes (id text primary key, name text not null);
insert into public.themes values ('paper','Paper'),('pastel','Pastel'),('terminal','Terminal'),('brutalist','Brutalist');
create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'paper' references public.themes(id),
  layout text not null default 'standard' check (layout in ('standard','compact')),
  presentation text not null default 'calm' check (presentation in ('calm','developer','playful')),
  show_activity boolean not null default true
);
create table public.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('activity','summary','recent')),
  position integer not null default 0 check (position >= 0),
  enabled boolean not null default true,
  unique(user_id,kind)
);
create table public.trackers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  description text not null default '' check (length(description)<=500),
  type text not null default 'habit' check (type in ('habit','counter','duration','numeric')),
  target double precision default 1 check (target > 0 and target <= 1e9),
  unit text not null default '' check (length(unit)<=24),
  goal_period text not null default 'daily' check (goal_period in ('daily','weekly','monthly')),
  schedule integer[] not null default array[0,1,2,3,4,5,6] check (cardinality(schedule) between 1 and 7 and schedule <@ array[0,1,2,3,4,5,6]),
  icon text not null default 'spark' check (icon in ('spark','book','heart','walk','code','water')),
  color text not null default 'sage' check (color in ('sage','peach','lavender','blue')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique(id,user_id,type),
  check (type <> 'habit' or (target is not null and target=trunc(target) and (goal_period<>'daily' or target=1)))
);
create table public.tracker_logs (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tracker_type text not null,
  tracking_date date not null,
  value double precision not null check (value >= 0 and value <= 1e9),
  created_at timestamptz not null default now(),
  foreign key(tracker_id,user_id,tracker_type) references public.trackers(id,user_id,type),
  check (tracker_type <> 'habit' or value=1)
);
create unique index habit_daily_unique on public.tracker_logs(tracker_id,tracking_date) where tracker_type='habit';
create index trackers_user_created on public.trackers(user_id,created_at);
create index logs_user_date on public.tracker_logs(user_id,tracking_date);
create index logs_tracker_date on public.tracker_logs(tracker_id,tracking_date);
create index widgets_user on public.dashboard_widgets(user_id);

alter table public.profiles enable row level security;
alter table public.themes enable row level security;
alter table public.user_preferences enable row level security;
alter table public.dashboard_widgets enable row level security;
alter table public.trackers enable row level security;
alter table public.tracker_logs enable row level security;
create policy profiles_read on public.profiles for select using ((select auth.uid())=id);
create policy profiles_update on public.profiles for update using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy themes_read on public.themes for select using (true);
create policy preferences_owned on public.user_preferences for all using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy widgets_owned on public.dashboard_widgets for all using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy trackers_read on public.trackers for select using ((select auth.uid())=user_id);
create policy trackers_insert on public.trackers for insert with check ((select auth.uid())=user_id);
create policy trackers_update on public.trackers for update using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
-- No tracker delete policy: archive through UPDATE, preserving history.
create policy logs_read on public.tracker_logs for select using ((select auth.uid())=user_id);
create policy logs_insert on public.tracker_logs for insert with check (
  (select auth.uid())=user_id and exists(select 1 from public.trackers t where t.id=tracker_id and t.user_id=(select auth.uid()) and t.archived_at is null)
);
create policy logs_update on public.tracker_logs for update using ((select auth.uid())=user_id) with check (
  (select auth.uid())=user_id and exists(select 1 from public.trackers t where t.id=tracker_id and t.user_id=(select auth.uid()) and t.archived_at is null)
);
create policy logs_delete on public.tracker_logs for delete using ((select auth.uid())=user_id);

create function public.initialize_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,timezone) values (new.id,case when exists(select 1 from pg_timezone_names where name=new.raw_user_meta_data->>'timezone') then new.raw_user_meta_data->>'timezone' else 'UTC' end);
  insert into public.user_preferences(user_id) values(new.id);
  insert into public.dashboard_widgets(user_id,kind,position) values(new.id,'summary',0),(new.id,'activity',1),(new.id,'recent',2);
  return new;
end;
$$;
revoke all on function public.initialize_user() from public,anon,authenticated;
create trigger on_user_created after insert on auth.users for each row execute procedure public.initialize_user();

create function public.record_log(p_tracker uuid,p_date date,p_value double precision,p_id uuid) returns void language plpgsql security invoker set search_path='' as $$
declare t public.trackers; tz text;
begin
  select * into t from public.trackers where id=p_tracker and user_id=auth.uid() and archived_at is null for update;
  if not found then raise exception 'Tracker unavailable' using errcode='42501'; end if;
  select timezone into tz from public.profiles where id=auth.uid();
  if p_date > (now() at time zone tz)::date or p_date < (t.created_at at time zone tz)::date then raise exception 'Date outside tracker history'; end if;
  if not extract(dow from p_date)::integer=any(t.schedule) then raise exception 'Tracker not scheduled on that date'; end if;
  insert into public.tracker_logs(id,tracker_id,user_id,tracker_type,tracking_date,value)
  values(p_id,t.id,auth.uid(),t.type,p_date,case when t.type='habit' then 1 else p_value end)
  on conflict do nothing;
end;
$$;
revoke all on function public.record_log(uuid,date,double precision,uuid) from public,anon;
grant execute on function public.record_log(uuid,date,double precision,uuid) to authenticated;
grant select on public.themes to anon,authenticated;
grant select,update on public.profiles to authenticated;
grant select,insert,update,delete on public.user_preferences,public.dashboard_widgets,public.tracker_logs to authenticated;
grant select,insert,update on public.trackers to authenticated;
