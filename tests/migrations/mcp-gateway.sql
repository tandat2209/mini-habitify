-- Private gateway storage must be unreachable from REST users and routine
-- tracking data must remain unreachable from the gateway database login.
do $$ begin
  if has_schema_privilege('anon','mcp_gateway','usage') or has_schema_privilege('authenticated','mcp_gateway','usage') then
    raise exception 'Gateway storage exposed to API users';
  end if;
  if has_table_privilege('mcp_gateway','public.trackers','select') or has_table_privilege('mcp_gateway','public.tracker_logs','insert') then
    raise exception 'Gateway storage role can bypass tracker RLS';
  end if;
  if (select rolbypassrls or rolsuper or rolcreaterole from pg_roles where rolname='mcp_gateway') then
    raise exception 'Gateway role has elevated database privileges';
  end if;
end $$;
insert into mcp_gateway.clients(id,upstream_id,metadata) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"redirect_uris":["https://example.com/callback"]}');
insert into public.mcp_connections(user_id,client_id,client_name,resource,grant_id) values('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Gateway migration test','https://example.com/mcp','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
insert into mcp_gateway.grants(id,user_id,client_id,upstream_client_id,upstream_grant_id,credentials) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc','encrypted');
insert into mcp_gateway.tokens(access_hash,refresh_hash,grant_id,scope,access_expires_at,refresh_expires_at) values('access-hash','refresh-hash','dddddddd-dddd-4ddd-8ddd-dddddddddddd',array['tracking:read'],now()+interval '1 hour',now()+interval '1 day');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('request.jwt.claims','{}',false);
update public.mcp_connections set revoked_at=now() where client_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
reset role;
do $$ begin
 if exists(select 1 from mcp_gateway.grants where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd') or exists(select 1 from mcp_gateway.tokens where access_hash='access-hash') then
   raise exception 'Disconnect did not erase gateway credentials and derived tokens';
 end if;
end $$;
-- Reapproval must also erase tokens rather than reviving old permissions.
insert into mcp_gateway.grants(id,user_id,client_id,upstream_client_id,upstream_grant_id,credentials) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc','encrypted');
update public.mcp_connections set grant_id=gen_random_uuid(),revoked_at=null where client_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
do $$ begin
 if exists(select 1 from mcp_gateway.grants where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd') then raise exception 'Reapproval revived gateway grant'; end if;
end $$;
