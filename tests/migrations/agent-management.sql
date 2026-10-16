-- Uses ordinary authenticated requests. Existing OAuth fixture is revoked here.
set role authenticated;
select set_config('request.jwt.claims','{}',false);
update public.mcp_connections set revoked_at=null,can_write=true where user_id=auth.uid();
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","client_id":"55555555-5555-4555-8555-555555555555","mcp_grant_id":"66666666-6666-4666-8666-666666666666","aud":["authenticated","https://test.example/mcp"]}',false);
do $$ begin
  if public.mcp_template_permission() then raise exception 'Legacy grant gained template access'; end if;
  begin
    perform public.publish_activity_template(p_name=>'Forbidden legacy grant',p_fields=>'[{"key":"n","label":"N","type":"text"}]');
    raise exception 'Legacy grant wrote template';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{}',false);
update public.mcp_connections set can_manage_templates=true where user_id=auth.uid();
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","client_id":"55555555-5555-4555-8555-555555555555","mcp_grant_id":"66666666-6666-4666-8666-666666666666","aud":["authenticated","https://test.example/mcp"]}',false);
do $$ declare t uuid; v uuid; tr uuid; l uuid; next_v uuid; begin
  t := public.publish_activity_template(p_name=>'Book Reading',p_fields=>'[{"key":"chapters","label":"Chapters","type":"textarea"},{"key":"understanding","label":"Understanding","type":"rating","config":{"min":1,"max":5}}]');
  select current_version_id into v from public.activity_templates where id=t;
  insert into public.trackers(user_id,name,type,target,goal_period,activity_template_id) values(auth.uid(),'DDIA','habit',3,'weekly',t) returning id into tr;
  l := public.record_log_with_details(tr,current_date,1,gen_random_uuid(),'{"chapters":"Chapter 7","understanding":4}',v);
  perform public.update_activity_template(t,v,p_fields=>'[{"key":"questions","label":"Questions","type":"text","required":true}]');
  update public.tracker_logs set details='{"chapters":"Chapter 7","understanding":5}' where id=l;
  if (select template_version_id from public.tracker_logs where id=l) <> v then raise exception 'Historical version changed'; end if;
  begin
    perform public.update_activity_template(t,v,p_name=>'Stale');
    raise exception 'Stale update accepted';
  exception when sqlstate 'PT409' then null; end;
  update public.activity_templates set archived_at=now() where id=t;
  if (select details->>'chapters' from public.tracker_logs where id=l) <> 'Chapter 7' then raise exception 'Archive lost data'; end if;
  begin
    insert into public.trackers(user_id,name,type,target,activity_template_id) values(auth.uid(),'Invalid','habit',1,t);
    raise exception 'Archived template assigned';
  exception when check_violation then null; end;
  begin
    perform public.publish_activity_template(p_template=>t,p_name=>'Archived',p_fields=>'[{"key":"a","label":"A","type":"text"}]');
    raise exception 'Archived template modified';
  exception when check_violation then null; end;
  begin
    perform public.validate_activity_details('[{"key":"r","label":"Rating","type":"rating","config":{"min":1,"max":5}}]','{"r":6}');
    raise exception 'Invalid rating accepted';
  exception when check_violation then null; end;
end $$;
-- Restore revoked fixture for other assertions.
select set_config('request.jwt.claims','{}',false);
update public.mcp_connections set revoked_at=now() where user_id=auth.uid();
reset role;
