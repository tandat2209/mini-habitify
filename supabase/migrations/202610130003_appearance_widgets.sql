update public.dashboard_widgets w set enabled=p.show_activity from public.user_preferences p where w.user_id=p.user_id and w.kind='activity';
alter table public.user_preferences drop column show_activity;
create function public.save_appearance(p_theme text,p_layout text,p_presentation text,p_show_activity boolean) returns void language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  insert into public.user_preferences(user_id,theme,layout,presentation) values(auth.uid(),p_theme,p_layout,p_presentation)
  on conflict(user_id) do update set theme=excluded.theme,layout=excluded.layout,presentation=excluded.presentation;
  insert into public.dashboard_widgets(user_id,kind,position,enabled) values(auth.uid(),'activity',1,p_show_activity)
  on conflict(user_id,kind) do update set enabled=excluded.enabled;
end;
$$;
revoke all on function public.save_appearance(text,text,text,boolean) from public,anon;
grant execute on function public.save_appearance(text,text,text,boolean) to authenticated;
