-- Match JavaScript String.trim() when validating content and field metadata.
create function public.activity_content_trim(p_text text) returns text language sql immutable strict parallel safe set search_path='' as $$
  select btrim(p_text, E' \t\n\r\f' || U&'\000B\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;
revoke all on function public.activity_content_trim(text) from public,anon;
grant execute on function public.activity_content_trim(text) to authenticated;
create or replace function public.validate_template_fields(p_fields jsonb) returns void language plpgsql immutable set search_path='' as $$
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
    if jsonb_typeof(f->'label') is distinct from 'string' or length(public.activity_content_trim(f->>'label')) not between 1 and 80 then raise exception 'Invalid field label'; end if;
    if jsonb_typeof(f->'type') is distinct from 'string' or typ not in ('text','number','date','select','multi_select','list') then raise exception 'Unsupported field type'; end if;
    if f ? 'required' and jsonb_typeof(f->'required') is distinct from 'boolean' then raise exception 'Required must be boolean'; end if;
    if f ? 'semanticType' and (jsonb_typeof(f->'semanticType') is distinct from 'string' or length(public.activity_content_trim(f->>'semanticType')) not between 1 and 80) then raise exception 'Invalid semantic type'; end if;
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
    if typ='number' then
      if jsonb_typeof(v) is distinct from 'number' then raise exception 'Invalid number: %',f->>'label'; end if;
      if (v#>>'{}')::numeric not between -1e12 and 1e12 then raise exception 'Number out of range'; end if;
    elsif typ in ('text','date','select') then
      if jsonb_typeof(v) is distinct from 'string' then raise exception 'Invalid text: %',f->>'label'; end if;
      if typ='text' and (length(public.activity_content_trim(v#>>'{}'))=0 or length(v#>>'{}')>5000) then raise exception 'Text must be nonempty and at most 5000 characters'; end if;
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
