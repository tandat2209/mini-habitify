-- Agent template management uses existing ownership and explicit write consent.
alter table public.activity_templates add column archived_at timestamptz;
do $$ declare t text; begin
  foreach t in array array['activity_templates','activity_template_versions'] loop
    execute format('drop policy mcp_no_content_writes on public.%I',t);
    execute format('create policy mcp_insert on public.%I as restrictive for insert to authenticated with check (public.mcp_permission(true))',t);
    execute format('create policy mcp_update on public.%I as restrictive for update to authenticated using (public.mcp_permission(true)) with check (public.mcp_permission(true))',t);
  end loop;
end $$;

-- Archived definitions remain readable and usable by existing associations.
create function public.guard_active_template() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.activity_template_id is not null and (tg_op='INSERT' or new.activity_template_id is distinct from old.activity_template_id) then
    perform 1 from public.activity_templates where id=new.activity_template_id and user_id=new.user_id and archived_at is null for share;
    if not found then raise exception 'Active template unavailable' using errcode='23514'; end if;
  end if;
  return new;
end;
$$;
create trigger tracker_active_template before insert or update on public.trackers for each row execute function public.guard_active_template();
revoke all on function public.guard_active_template() from public,anon,authenticated;

create or replace function public.validate_template_fields(p_fields jsonb) returns void language plpgsql immutable set search_path='' as $$
declare f jsonb; k text; typ text;
begin
  if jsonb_typeof(p_fields) is distinct from 'array' then raise exception 'Fields must be an array'; end if;
  if jsonb_array_length(p_fields) not between 1 and 30 then raise exception 'Use 1 to 30 fields'; end if;
  if (select count(distinct value->>'key') from jsonb_array_elements(p_fields)) <> jsonb_array_length(p_fields) then raise exception 'Field keys must be unique'; end if;
  for f in select value from jsonb_array_elements(p_fields) loop
    if jsonb_typeof(f) is distinct from 'object' then raise exception 'Invalid field definition'; end if;
    if exists(select 1 from jsonb_object_keys(f) as x(key) where key not in ('key','label','type','required','options','semanticType','config')) then raise exception 'Unsupported field property'; end if;
    k := f->>'key'; typ := f->>'type';
    if jsonb_typeof(f->'key') is distinct from 'string' or k !~ '^[a-z][a-z0-9_]{0,63}$' or k in ('constructor','prototype','__proto__') then raise exception 'Invalid field key'; end if;
    if jsonb_typeof(f->'label') is distinct from 'string' or length(public.activity_content_trim(f->>'label')) not between 1 and 80 then raise exception 'Invalid field label'; end if;
    if jsonb_typeof(f->'type') is distinct from 'string' or typ not in ('text','textarea','rating','number','date','select','multi_select','list') then raise exception 'Unsupported field type'; end if;
    if f ? 'required' and jsonb_typeof(f->'required') is distinct from 'boolean' then raise exception 'Required must be boolean'; end if;
    if f ? 'semanticType' and (jsonb_typeof(f->'semanticType') is distinct from 'string' or length(public.activity_content_trim(f->>'semanticType')) not between 1 and 80) then raise exception 'Invalid semantic type'; end if;
    if typ='rating' then
      if jsonb_typeof(f->'config') is distinct from 'object' then raise exception 'Ratings require min/max' using errcode='23514'; end if;
      if exists(select 1 from jsonb_object_keys(f->'config') as x(key) where key not in ('min','max')) or jsonb_typeof(f->'config'->'min') is distinct from 'number' or jsonb_typeof(f->'config'->'max') is distinct from 'number' then raise exception 'Invalid rating config' using errcode='23514'; end if;
      if (f->'config'->>'min')::numeric <> trunc((f->'config'->>'min')::numeric) or (f->'config'->>'max')::numeric <> trunc((f->'config'->>'max')::numeric) or (f->'config'->>'min')::numeric < -1e12 or (f->'config'->>'max')::numeric > 1e12 or (f->'config'->>'min')::numeric >= (f->'config'->>'max')::numeric then raise exception 'Invalid rating bounds' using errcode='23514'; end if;
    elsif f ? 'config' then raise exception 'Only ratings accept config' using errcode='23514'; end if;
    if typ in ('select','multi_select') then
      if jsonb_typeof(f->'options') is distinct from 'array' then raise exception 'Selection fields need options'; end if;
      if jsonb_array_length(f->'options') not between 1 and 50 or exists(select 1 from jsonb_array_elements(f->'options') where jsonb_typeof(value) <> 'string' or length(public.activity_content_trim(value#>>'{}')) not between 1 and 120) then raise exception 'Invalid options'; end if;
      if (select count(distinct value) from jsonb_array_elements(f->'options')) <> jsonb_array_length(f->'options') then raise exception 'Options must be unique'; end if;
    elsif f ? 'options' then raise exception 'Only selection fields accept options'; end if;
  end loop;
end;
$$;
create or replace function public.validate_activity_details(p_fields jsonb,p_details jsonb) returns void language plpgsql immutable set search_path='' as $$
declare f jsonb; v jsonb; k text; typ text; date_value date;
begin
  if jsonb_typeof(p_details) is distinct from 'object' then raise exception 'Details must be an object'; end if;
  if p_details='{}'::jsonb then return; end if;
  if exists(select 1 from jsonb_object_keys(p_details) as x(key) where not exists(select 1 from jsonb_array_elements(p_fields) as field_def(value) where field_def.value->>'key'=x.key)) then raise exception 'Unknown detail field'; end if;
  for f in select value from jsonb_array_elements(p_fields) loop
    k := f->>'key'; typ := f->>'type'; v := p_details->k;
    if not p_details ? k then
      if coalesce((f->>'required')::boolean,false) then raise exception 'Required detail missing: %',f->>'label'; end if;
      continue;
    end if;
    if typ in ('number','rating') then
      if jsonb_typeof(v) is distinct from 'number' then raise exception 'Invalid number: %',f->>'label'; end if;
      if (v#>>'{}')::numeric not between -1e12 and 1e12 then raise exception 'Number out of range'; end if;
      if typ='rating' and ((v#>>'{}')::numeric <> trunc((v#>>'{}')::numeric) or (v#>>'{}')::numeric not between (f->'config'->>'min')::numeric and (f->'config'->>'max')::numeric) then raise exception 'Rating out of range' using errcode='23514'; end if;
    elsif typ in ('text','textarea','date','select') then
      if jsonb_typeof(v) is distinct from 'string' then raise exception 'Invalid text: %',f->>'label'; end if;
      if typ in ('text','textarea') and (length(public.activity_content_trim(v#>>'{}'))=0 or length(v#>>'{}')>5000) then raise exception 'Text must be nonempty and at most 5000 characters'; end if;
      if typ='select' and not (f->'options') @> jsonb_build_array(v) then raise exception 'Choose a listed option'; end if;
      if typ='date' then
        if (v#>>'{}') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid date'; end if;
        date_value := (v#>>'{}')::date;
        if to_char(date_value,'YYYY-MM-DD') <> (v#>>'{}') then raise exception 'Invalid date'; end if;
      end if;
    else
      if jsonb_typeof(v) is distinct from 'array' then raise exception 'Invalid list: %',f->>'label'; end if;
      if jsonb_array_length(v) not between 1 and (case when typ='list' then 100 else 50 end) then raise exception 'Invalid list size'; end if;
      if exists(select 1 from jsonb_array_elements(v) where jsonb_typeof(value)<>'string' or length(public.activity_content_trim(value#>>'{}'))=0 or (typ='list' and length(value#>>'{}')>500)) then raise exception 'List items must be nonempty strings'; end if;
      if typ='multi_select' and (not (f->'options') @> v or (select count(distinct value) from jsonb_array_elements(v))<>jsonb_array_length(v)) then raise exception 'Choose distinct listed options'; end if;
    end if;
  end loop;
end;
$$;

create or replace function public.publish_activity_template(p_template uuid default null,p_name text default '',p_description text default '',p_fields jsonb default '[]') returns uuid language plpgsql security invoker set search_path='' as $$
declare template uuid; version_id uuid; next_version integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_template is not null then
    perform 1 from public.activity_templates where id=p_template and user_id=auth.uid() and archived_at is null for update;
    if not found then raise exception 'Active template unavailable' using errcode='23514'; end if;
  end if;
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
-- The expected immutable version prevents lost updates across agents and app edits.
create or replace function public.update_activity_template(p_template uuid,p_expected_version uuid,p_name text default null,p_description text default null,p_fields jsonb default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare t public.activity_templates;
begin
  select * into t from public.activity_templates where id=p_template and user_id=auth.uid() and archived_at is null for update;
  if not found then raise exception 'Active template unavailable' using errcode='42501'; end if;
  if t.current_version_id is distinct from p_expected_version then raise exception 'Template changed. Read it again before updating.' using errcode='PT409'; end if;
  return public.publish_activity_template(t.id,coalesce(p_name,t.name),coalesce(p_description,t.description),coalesce(p_fields,(select fields from public.activity_template_versions where id=t.current_version_id and user_id=auth.uid())));
end;
$$;
revoke all on function public.update_activity_template(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.update_activity_template(uuid,uuid,text,text,jsonb) to authenticated;
