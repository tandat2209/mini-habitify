-- Disambiguate the JSON schema element from the PL/pgSQL field variable.
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

create or replace function public.publish_activity_template(p_template uuid default null,p_name text default '',p_description text default '',p_fields jsonb default '[]') returns uuid language plpgsql security invoker set search_path='' as $$
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