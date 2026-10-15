create function public.save_dashboard_appearance(p_theme text,p_layout text,p_presentation text,p_widgets jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare w jsonb; i integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if jsonb_typeof(p_widgets) is distinct from 'array' or jsonb_array_length(p_widgets) <> 3 then raise exception 'Supply all three widgets'; end if;
  if (select count(distinct value->>'kind') from jsonb_array_elements(p_widgets)) <> 3 or exists(select 1 from jsonb_array_elements(p_widgets) where value->>'kind' not in ('summary','activity','recent') or value->>'kind' is null or jsonb_typeof(value->'enabled') is distinct from 'boolean') then raise exception 'Invalid widget settings'; end if;
  insert into public.user_preferences(user_id,theme,layout,presentation) values(auth.uid(),p_theme,p_layout,p_presentation)
  on conflict(user_id) do update set theme=excluded.theme,layout=excluded.layout,presentation=excluded.presentation;
  for w in select value from jsonb_array_elements(p_widgets) loop
    insert into public.dashboard_widgets(user_id,kind,position,enabled) values(auth.uid(),w->>'kind',i,(w->>'enabled')::boolean)
    on conflict(user_id,kind) do update set position=excluded.position,enabled=excluded.enabled;
    i := i+1;
  end loop;
end;
$$;
revoke all on function public.save_dashboard_appearance(text,text,text,jsonb) from public,anon;
grant execute on function public.save_dashboard_appearance(text,text,text,jsonb) to authenticated;
