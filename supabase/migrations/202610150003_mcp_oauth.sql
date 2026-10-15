-- OAuth access is opt-in and independent from first-party browser sessions.
create table public.mcp_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  client_name text not null check (length(client_name) between 1 and 200),
  resource text not null check (length(resource) <= 2048 and resource ~ '^https?://'),
  grant_id uuid not null default gen_random_uuid(),
  can_write boolean not null default false,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, client_id)
);
alter table public.mcp_connections enable row level security;
grant select,insert,update on public.mcp_connections to authenticated;
create policy browser_connections on public.mcp_connections for all to authenticated
  using (user_id=auth.uid() and (auth.jwt()->>'client_id') is null)
  with check (user_id=auth.uid() and (auth.jwt()->>'client_id') is null);

-- Small definer boundary: no supplied identity, no arbitrary SQL, no data returned.
create function public.mcp_permission(p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
  select (auth.jwt()->>'client_id') is null or exists (
    select 1 from public.mcp_connections c
    where c.user_id=auth.uid() and c.client_id::text=auth.jwt()->>'client_id'
      and c.grant_id::text=auth.jwt()->>'mcp_grant_id' and c.revoked_at is null
      and (not p_write or c.can_write)
      and (auth.jwt()->'aud' ? c.resource or auth.jwt()->>'aud'=c.resource)
  );
$$;
revoke all on function public.mcp_permission(boolean) from public;
grant execute on function public.mcp_permission(boolean) to authenticated;

-- Restrictive policies combine with the existing owner policies (logical AND).
do $$ declare t text; begin
  foreach t in array array['trackers','tracker_logs'] loop
    execute format('create policy mcp_read on public.%I as restrictive for select to authenticated using (public.mcp_permission(false))',t);
    execute format('create policy mcp_insert on public.%I as restrictive for insert to authenticated with check (public.mcp_permission(true))',t);
    execute format('create policy mcp_update on public.%I as restrictive for update to authenticated using (public.mcp_permission(true)) with check (public.mcp_permission(true))',t);
    execute format('create policy mcp_delete on public.%I as restrictive for delete to authenticated using (public.mcp_permission(true))',t);
  end loop;
  foreach t in array array['activity_templates','activity_template_versions'] loop
    execute format('create policy mcp_read on public.%I as restrictive for select to authenticated using (public.mcp_permission(false))',t);
    execute format('create policy mcp_no_content_writes on public.%I as restrictive for all to authenticated using ((auth.jwt()->>''client_id'') is null or public.mcp_permission(false)) with check ((auth.jwt()->>''client_id'') is null)',t);
    -- DELETE has no WITH CHECK, so explicitly deny it to OAuth clients too.
    execute format('create policy mcp_no_content_delete on public.%I as restrictive for delete to authenticated using ((auth.jwt()->>''client_id'') is null)',t);
  end loop;
  foreach t in array array['user_preferences','dashboard_widgets'] loop
    execute format('create policy browser_only on public.%I as restrictive for all to authenticated using ((auth.jwt()->>''client_id'') is null) with check ((auth.jwt()->>''client_id'') is null)',t);
  end loop;
end $$;
create policy mcp_profile_read on public.profiles as restrictive for select to authenticated using (public.mcp_permission(false));
create policy mcp_profile_update on public.profiles as restrictive for update to authenticated using ((auth.jwt()->>'client_id') is null) with check ((auth.jwt()->>'client_id') is null);

-- Supabase invokes this hook before issuing/refreshing tokens. Only explicit
-- app consent adds an MCP audience; ordinary browser tokens are untouched.
create function public.mcp_access_token_hook(event jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare claims jsonb := event->'claims'; c public.mcp_connections;
begin
  if claims->>'client_id' is not null then
    -- OAuth tokens represent a resource grant, not a first-party Auth session.
    -- GoTrue account APIs must reject them (their session does not exist in
    -- auth.sessions). The original OAuth session remains server-side for PKCE,
    -- refresh rotation and native revocation. PostgREST uses sub + owner RLS.
    claims := jsonb_set(claims,'{session_id}',to_jsonb(gen_random_uuid()::text));
    select * into c from public.mcp_connections
      where user_id=(event->>'user_id')::uuid and client_id::text=claims->>'client_id' and revoked_at is null;
    if found then
      claims := jsonb_set(claims,'{aud}',jsonb_build_array('authenticated',c.resource));
      claims := jsonb_set(claims,'{mcp_grant_id}',to_jsonb(c.grant_id::text));
      claims := jsonb_set(claims,'{session_id}',to_jsonb(c.grant_id::text));
    end if;
  end if;
  return jsonb_build_object('claims',claims);
end;
$$;
revoke all on function public.mcp_access_token_hook(jsonb) from public,anon,authenticated;
grant execute on function public.mcp_access_token_hook(jsonb) to supabase_auth_admin;

-- Shared database limiter survives serverless instances. No token or content stored.
create table public.mcp_request_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  window_start timestamptz not null,
  requests integer not null,
  primary key(user_id,client_id)
);
alter table public.mcp_request_limits enable row level security;
revoke all on public.mcp_request_limits from anon,authenticated;
create function public.consume_mcp_request() returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer; begin
  if (auth.jwt()->>'client_id') is null or not public.mcp_permission(false) then return false; end if;
  insert into public.mcp_request_limits as limits(user_id,client_id,window_start,requests)
    values(auth.uid(),(auth.jwt()->>'client_id')::uuid,date_trunc('minute',now()),1)
    on conflict(user_id,client_id) do update set
      requests=case when limits.window_start=date_trunc('minute',now()) then limits.requests+1 else 1 end,
      window_start=date_trunc('minute',now()) returning requests into n;
  return n<=120;
end;
$$;
revoke all on function public.consume_mcp_request() from public;
grant execute on function public.consume_mcp_request() to authenticated;
