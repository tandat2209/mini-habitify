-- Private OAuth credential storage; never exposed through the public REST schema.
-- A separate login/password is provisioned at deployment, outside source control.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='mcp_gateway') then
    create role mcp_gateway nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end $$;
create schema mcp_gateway;
revoke all on schema mcp_gateway from public,anon,authenticated,service_role;
grant usage on schema mcp_gateway to mcp_gateway;
create table mcp_gateway.clients (
  id uuid primary key default gen_random_uuid(),
  upstream_id uuid not null unique,
  metadata jsonb not null,
  created_at timestamptz not null default now()
);
create table mcp_gateway.pending (
  state_hash text primary key,
  authorization_id text not null unique,
  client_id uuid not null references mcp_gateway.clients(id) on delete cascade,
  request jsonb not null,
  verifier text not null,
  browser_hash text not null,
  expires_at timestamptz not null default now()+interval '10 minutes'
);
create table mcp_gateway.grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references mcp_gateway.clients(id) on delete cascade,
  upstream_client_id uuid not null,
  upstream_grant_id uuid not null,
  credentials text not null,
  expires_at timestamptz not null default now()+interval '30 days'
);
create table mcp_gateway.codes (
  hash text primary key,
  grant_id uuid not null references mcp_gateway.grants(id) on delete cascade,
  redirect_uri text not null,
  challenge text not null,
  scope text[] not null,
  expires_at timestamptz not null
);
create table mcp_gateway.tokens (
  access_hash text primary key,
  refresh_hash text not null unique,
  grant_id uuid not null references mcp_gateway.grants(id) on delete cascade,
  scope text[] not null,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  refresh_used_at timestamptz
);
-- A bounded, shared limiter also protects unauthenticated registration/authorize.
create table mcp_gateway.limits (
  key text primary key,
  window_start timestamptz not null,
  requests integer not null
);
do $$ declare t text; begin
  foreach t in array array['clients','pending','grants','codes','tokens','limits'] loop
    execute format('alter table mcp_gateway.%I enable row level security',t);
    execute format('grant select,insert,update,delete on mcp_gateway.%I to mcp_gateway',t);
    execute format('create policy gateway_storage on mcp_gateway.%I to mcp_gateway using (true) with check (true)',t);
  end loop;
end $$;
-- Disconnect/reapproval immediately destroys credentials and all derived tokens.
create function mcp_gateway.revoke_connection() returns trigger
language plpgsql security definer set search_path='' as $$ begin
  delete from mcp_gateway.grants where user_id=old.user_id and upstream_client_id=old.client_id
    and (new.revoked_at is not null or upstream_grant_id<>new.grant_id);
  return new;
end $$;
revoke all on function mcp_gateway.revoke_connection() from public,anon,authenticated;
create trigger mcp_gateway_disconnect after update of revoked_at,grant_id on public.mcp_connections
  for each row execute function mcp_gateway.revoke_connection();
