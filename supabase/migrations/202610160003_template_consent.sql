-- Prior consent explicitly excluded template writes. Do not expand old grants.
alter table public.mcp_connections add column can_manage_templates boolean not null default false;
create function public.mcp_template_permission() returns boolean
language sql stable security definer set search_path='' as $$
  select (auth.jwt()->>'client_id') is null or (
    public.mcp_permission(true) and exists (
      select 1 from public.mcp_connections c where c.user_id=auth.uid()
        and c.client_id::text=auth.jwt()->>'client_id'
        and c.grant_id::text=auth.jwt()->>'mcp_grant_id'
        and c.can_manage_templates
    )
  );
$$;
revoke all on function public.mcp_template_permission() from public,anon;
grant execute on function public.mcp_template_permission() to authenticated;
do $$ declare t text; begin
  foreach t in array array['activity_templates','activity_template_versions'] loop
    execute format('drop policy mcp_insert on public.%I',t);
    execute format('drop policy mcp_update on public.%I',t);
    execute format('create policy mcp_insert on public.%I as restrictive for insert to authenticated with check (public.mcp_template_permission())',t);
    execute format('create policy mcp_update on public.%I as restrictive for update to authenticated using (public.mcp_template_permission()) with check (public.mcp_template_permission())',t);
  end loop;
end $$;
