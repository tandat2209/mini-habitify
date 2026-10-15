-- Runs after the legacy compatibility assertions in the isolated replay DB.
set role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111"}',false);
insert into public.mcp_connections(user_id,client_id,client_name,resource,grant_id)
values(auth.uid(),'55555555-5555-4555-8555-555555555555','Test assistant','https://test.example/mcp','66666666-6666-4666-8666-666666666666');
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","client_id":"55555555-5555-4555-8555-555555555555"}',false);
do $$ begin
  if public.mcp_permission(false) or exists(select 1 from public.trackers) then raise exception 'Unapproved OAuth token can access tracking'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","client_id":"55555555-5555-4555-8555-555555555555","mcp_grant_id":"66666666-6666-4666-8666-666666666666","aud":["authenticated","https://test.example/mcp"]}',false);
do $$ begin
  if not public.mcp_permission(false) or public.mcp_permission(true) then raise exception 'Incorrect read-only permissions'; end if;
  if not exists(select 1 from public.trackers) then raise exception 'Read-only tracker read failed'; end if;
  if exists(select 1 from public.user_preferences) or exists(select 1 from public.mcp_connections) then raise exception 'OAuth can read private settings'; end if;
  begin
    insert into public.trackers(user_id,name,type,target) values(auth.uid(),'Forbidden','habit',1);
    raise exception 'Read-only OAuth write succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.publish_activity_template(p_name=>'Forbidden',p_fields=>'[{"key":"notes","label":"Notes","type":"text"}]');
    raise exception 'OAuth template publication succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.mcp_access_token_hook('{}');
    raise exception 'Authenticated user can invoke Auth token hook';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{}',false);
update public.mcp_connections set can_write=true where user_id=auth.uid();
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","client_id":"55555555-5555-4555-8555-555555555555","mcp_grant_id":"66666666-6666-4666-8666-666666666666","aud":["authenticated","https://test.example/mcp"]}',false);
select public.record_log('22222222-2222-4222-8222-222222222222',current_date,1,'77777777-7777-4777-8777-777777777777');
do $$ declare n integer; begin
  if not public.mcp_permission(true) then raise exception 'Write permission missing'; end if;
  for n in 1..120 loop
    if not public.consume_mcp_request() then raise exception 'Rate limit rejected valid request'; end if;
  end loop;
  if public.consume_mcp_request() then raise exception 'Rate limit failed'; end if;
  if (select count(*) from public.tracker_logs) <> 1 then raise exception 'OAuth changed habit idempotency'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'OAuth timezone lookup failed'; end if;
  update public.profiles set timezone='Europe/London' where id=auth.uid();
  if found then raise exception 'OAuth modified profile'; end if;
end $$;
select set_config('request.jwt.claims','{}',false);
update public.mcp_connections set revoked_at=now() where user_id=auth.uid();
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","client_id":"55555555-5555-4555-8555-555555555555","mcp_grant_id":"66666666-6666-4666-8666-666666666666","aud":["authenticated","https://test.example/mcp"]}',false);
do $$ begin
  if public.mcp_permission(false) or exists(select 1 from public.trackers) then raise exception 'Revoked token still works'; end if;
end $$;
reset role;
