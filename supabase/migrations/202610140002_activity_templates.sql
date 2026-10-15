-- Structured content is independent of tracker metrics. Versions are immutable.
create table public.activity_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  description text not null default '' check (length(description)<=500),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id)
);
create table public.activity_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  version integer not null check(version>0),
  fields jsonb not null,
  created_at timestamptz not null default now(),
  foreign key(template_id,user_id) references public.activity_templates(id,user_id),
  unique(template_id,version),
  unique(id,user_id),
  unique(id,template_id,user_id)
);
alter table public.activity_templates add foreign key(current_version_id,id,user_id) references public.activity_template_versions(id,template_id,user_id);
alter table public.trackers add column activity_template_id uuid;
alter table public.trackers add foreign key(activity_template_id,user_id) references public.activity_templates(id,user_id);
alter table public.tracker_logs add column details jsonb not null default '{}'::jsonb check(jsonb_typeof(details)='object');
alter table public.tracker_logs add column template_version_id uuid;
alter table public.tracker_logs add foreign key(template_version_id,user_id) references public.activity_template_versions(id,user_id);
create index activity_templates_user_created on public.activity_templates(user_id,created_at);
create index template_versions_user_template on public.activity_template_versions(user_id,template_id);
create index trackers_template on public.trackers(activity_template_id) where activity_template_id is not null;
create index logs_template_version on public.tracker_logs(template_version_id) where template_version_id is not null;
alter table public.activity_templates enable row level security;
alter table public.activity_template_versions enable row level security;
create policy templates_read on public.activity_templates for select using((select auth.uid())=user_id);
create policy templates_insert on public.activity_templates for insert with check((select auth.uid())=user_id);
create policy templates_update on public.activity_templates for update using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy versions_read on public.activity_template_versions for select using((select auth.uid())=user_id);
create policy versions_insert on public.activity_template_versions for insert with check((select auth.uid())=user_id);
grant select,insert,update on public.activity_templates to authenticated;
grant select,insert on public.activity_template_versions to authenticated;

create function public.validate_template_fields(p_fields jsonb) returns void language plpgsql immutable set search_path='' as $$
declare f jsonb; k text; typ text;
begin
  if jsonb_typeof(p_fields) is distinct from 'array' then raise exception 'Fields must be an array'; end if;
  if jsonb_array_length(p_fields) not between 1 and 30 then raise exception 'Use 1 to 30 fields'; end if;
  if (select count(distinct value->>'key') from jsonb_array_elements(p_fields)) <> jsonb_array_length(p_fields) then raise exception 'Field keys must be unique'; end if;
  for f in select value from jsonb_array_elements(p_fields) loop
    if jsonb_typeof(f) is distinct from 'object' then raise exception 'Invalid field definition'; end if;
    if exists(select 1 from jsonb_object_keys(f) as x(key) where key not in ('key','label','type','required','options','semanticType')) then raise exception 'Unsupported field property'; end if;
    k := f->>'key'; typ := f->>'type';
    if jsonb_typeof(f->'key') is distinct from 'string' or k !~ '^[a-z][a-z0-9_]{0,63}$' or k in ('constructor','prototype','__proto__') then raise exception 'Invalid field key'; end if;
    if jsonb_typeof(f->'label') is distinct from 'string' or length(trim(f->>'label')) not between 1 and 80 then raise exception 'Invalid field label'; end if;
    if jsonb_typeof(f->'type') is distinct from 'string' or typ not in ('text','number','date','select','multi_select','list') then raise exception 'Unsupported field type'; end if;
    if f ? 'required' and jsonb_typeof(f->'required') is distinct from 'boolean' then raise exception 'Required must be boolean'; end if;
    if f ? 'semanticType' and (jsonb_typeof(f->'semanticType') is distinct from 'string' or length(trim(f->>'semanticType')) not between 1 and 80) then raise exception 'Invalid semantic type'; end if;
    if typ in ('select','multi_select') then
      if jsonb_typeof(f->'options') is distinct from 'array' then raise exception 'Selection fields need options'; end if;
      if jsonb_array_length(f->'options') not between 1 and 50 or exists(select 1 from jsonb_array_elements(f->'options') where jsonb_typeof(value) <> 'string' or length(trim(value#>>'{}')) not between 1 and 120) then raise exception 'Invalid options'; end if;
      if (select count(distinct value) from jsonb_array_elements(f->'options')) <> jsonb_array_length(f->'options') then raise exception 'Options must be unique'; end if;
    elsif f ? 'options' then raise exception 'Only selection fields accept options'; end if;
  end loop;
end;
$$;
create function public.validate_template_version() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op <> 'INSERT' then raise exception 'Template versions are immutable'; end if;
  perform public.validate_template_fields(new.fields);
  return new;
end;
$$;
create trigger immutable_template_version before insert or update or delete on public.activity_template_versions for each row execute function public.validate_template_version();

create function public.validate_activity_details(p_fields jsonb,p_details jsonb) returns void language plpgsql immutable set search_path='' as $$
declare f jsonb; v jsonb; k text; typ text; date_value date;
begin
  if jsonb_typeof(p_details) is distinct from 'object' then raise exception 'Details must be an object'; end if;
  if p_details='{}'::jsonb then return; end if;
  if exists(select 1 from jsonb_object_keys(p_details) as x(key) where not exists(select 1 from jsonb_array_elements(p_fields) f where f->>'key'=x.key)) then raise exception 'Unknown detail field'; end if;
  for f in select value from jsonb_array_elements(p_fields) loop
    k := f->>'key'; typ := f->>'type'; v := p_details->k;
    if not p_details ? k then
      if coalesce((f->>'required')::boolean,false) then raise exception 'Required detail missing: %',f->>'label'; end if;
      continue;
    end if;
    if typ='number' then
      if jsonb_typeof(v) is distinct from 'number' then raise exception 'Invalid number: %',f->>'label'; end if;
      if (v#>>'{}')::numeric not between -1e12 and 1e12 then raise exception 'Number out of range'; end if;
    elsif typ in ('text','date','select') then
      if jsonb_typeof(v) is distinct from 'string' then raise exception 'Invalid text: %',f->>'label'; end if;
      if typ='text' and (length(trim(v#>>'{}'))=0 or length(v#>>'{}')>5000) then raise exception 'Text must be nonempty and at most 5000 characters'; end if;
      if typ='select' and not (f->'options') @> jsonb_build_array(v) then raise exception 'Choose a listed option'; end if;
      if typ='date' then
        if (v#>>'{}') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid date'; end if;
        date_value := (v#>>'{}')::date;
        if to_char(date_value,'YYYY-MM-DD') <> (v#>>'{}') then raise exception 'Invalid date'; end if;
      end if;
    else
      if jsonb_typeof(v) is distinct from 'array' then raise exception 'Invalid list: %',f->>'label'; end if;
      if jsonb_array_length(v) not between 1 and (case when typ='list' then 100 else 50 end) then raise exception 'Invalid list size'; end if;
      if exists(select 1 from jsonb_array_elements(v) where jsonb_typeof(value)<>'string' or length(trim(value#>>'{}'))=0 or (typ='list' and length(value#>>'{}')>500)) then raise exception 'List items must be nonempty strings'; end if;
      if typ='multi_select' and (not (f->'options') @> v or (select count(distinct value) from jsonb_array_elements(v))<>jsonb_array_length(v)) then raise exception 'Choose distinct listed options'; end if;
    end if;
  end loop;
end;
$$;

create function public.validate_log_details() returns trigger language plpgsql security invoker set search_path='' as $$
declare template uuid; current_version uuid; schema jsonb;
begin
  if tg_op='INSERT' then
    select activity_template_id into template from public.trackers where id=new.tracker_id and user_id=new.user_id for update;
    if template is not null then
      select current_version_id into current_version from public.activity_templates where id=template and user_id=new.user_id for share;
      if current_version is null then raise exception 'Template has no published version'; end if;
    end if;
    if new.template_version_id is not null and new.template_version_id is distinct from current_version then raise exception 'Template changed. Review its current fields before saving.'; end if;
    new.template_version_id := current_version;
  else
    if new.template_version_id is distinct from old.template_version_id or new.tracker_id is distinct from old.tracker_id or new.user_id is distinct from old.user_id then raise exception 'Recorded template and activity cannot be changed'; end if;
  end if;
  schema := '[]'::jsonb;
  if new.template_version_id is not null then
    select fields into schema from public.activity_template_versions where id=new.template_version_id and user_id=new.user_id;
    if not found then raise exception 'Template version unavailable' using errcode='42501'; end if;
  end if;
  perform public.validate_activity_details(schema,new.details);
  return new;
end;
$$;
create trigger validate_tracker_log_details before insert or update on public.tracker_logs for each row execute function public.validate_log_details();

create function public.publish_activity_template(p_template uuid default null,p_name text default '',p_description text default '',p_fields jsonb default '[]') returns uuid language plpgsql security invoker set search_path='' as $$
declare template uuid; version_id uuid; next_version integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform public.validate_template_fields(p_fields);
  if p_template is null then
    insert into public.activity_templates(user_id,name,description) values(auth.uid(),p_name,p_description) returning id into template;
  else
    select id into template from public.activity_templates where id=p_template and user_id=auth.uid() for update;
    if not found then raise exception 'Template unavailable' using errcode='42501'; end if;
  end if;
  select coalesce(max(version),0)+1 into next_version from public.activity_template_versions where template_id=template;
  insert into public.activity_template_versions(template_id,user_id,version,fields) values(template,auth.uid(),next_version,p_fields) returning id into version_id;
  update public.activity_templates set name=p_name,description=p_description,current_version_id=version_id,updated_at=now() where id=template;
  return template;
end;
$$;
create function public.record_log_with_details(p_tracker uuid,p_date date,p_value double precision,p_id uuid,p_details jsonb default '{}',p_template_version uuid default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare t public.trackers; existing public.tracker_logs;
begin
  select * into t from public.trackers where id=p_tracker and user_id=auth.uid() and archived_at is null for update;
  if not found then raise exception 'Tracker unavailable' using errcode='42501'; end if;
  select * into existing from public.tracker_logs where user_id=auth.uid() and (id=p_id or (t.type='habit' and tracker_id=t.id and tracking_date=p_date)) order by (id=p_id) desc limit 1;
  if found then
    if existing.tracker_id<>t.id or existing.tracking_date<>p_date then raise exception 'Request ID already used for another entry'; end if;
    return existing.id;
  end if;
  insert into public.tracker_logs(id,tracker_id,user_id,tracker_type,tracking_date,value,details,template_version_id)
  values(p_id,t.id,auth.uid(),t.type,p_date,case when t.type='habit' then 1 else p_value end,p_details,p_template_version);
  return p_id;
end;
$$;
-- Preserve the existing public RPC signature while sharing validation/idempotency.
create or replace function public.record_log(p_tracker uuid,p_date date,p_value double precision,p_id uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
  perform public.record_log_with_details(p_tracker,p_date,p_value,p_id);
end;
$$;
revoke all on function public.validate_template_fields(jsonb),public.validate_template_version(),public.validate_activity_details(jsonb,jsonb),public.validate_log_details() from public,anon,authenticated;
-- Invoker RPCs/triggers need these pure validators, which expose no stored data.
grant execute on function public.validate_template_fields(jsonb),public.validate_activity_details(jsonb,jsonb) to authenticated;
revoke all on function public.publish_activity_template(uuid,text,text,jsonb),public.record_log_with_details(uuid,date,double precision,uuid,jsonb,uuid) from public,anon;
grant execute on function public.publish_activity_template(uuid,text,text,jsonb),public.record_log_with_details(uuid,date,double precision,uuid,jsonb,uuid) to authenticated;
