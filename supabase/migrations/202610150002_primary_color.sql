-- Optional user-owned appearance override. NULL follows the selected theme.
alter table public.user_preferences add column primary_color text
  check(primary_color ~ '^#[0-9a-fA-F]{6}$');
-- Keep the existing RPC signatures intact. The original atomic save remains the
-- single owner of theme/layout/widget validation, and older clients retain color.
create function public.save_dashboard_appearance_with_color(
  p_theme text,p_layout text,p_presentation text,p_widgets jsonb,p_primary_color text default null
) returns void language plpgsql security invoker set search_path='' as $$
begin
  perform public.save_dashboard_appearance(p_theme,p_layout,p_presentation,p_widgets);
  update public.user_preferences set primary_color=lower(p_primary_color) where user_id=auth.uid();
end;
$$;
revoke all on function public.save_dashboard_appearance_with_color(text,text,text,jsonb,text) from public,anon;
grant execute on function public.save_dashboard_appearance_with_color(text,text,text,jsonb,text) to authenticated;
