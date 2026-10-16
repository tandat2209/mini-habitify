import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
// Uses an isolated database in the local Supabase PostgreSQL container.
// Never resets, copies, or deletes the application's database.
const project = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id = "([a-zA-Z0-9_-]+)"/m,
)?.[1];
if (!project) throw new Error("Local Supabase project ID is missing.");
const container = `supabase_db_${project}`;
const database = `habitify_migration_${Date.now()}`;
function sql(databaseName, input) {
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      databaseName,
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    { input, encoding: "utf8" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      result.stderr || result.stdout || "Migration replay failed.",
    );
  return result.stdout;
}
const files = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort();
const foundation = files.filter((f) => f < "202610140002");
const extension = files.filter((f) => f >= "202610140002");
const migrations = (names) =>
  names.map((f) => readFileSync(`supabase/migrations/${f}`, "utf8")).join("\n");
let created = false;
try {
  sql("postgres", `create database ${database};`);
  created = true;
  sql(
    database,
    `
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}');
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    ${migrations(foundation)}
    insert into auth.users(id,raw_user_meta_data) values('11111111-1111-4111-8111-111111111111','{"timezone":"UTC"}');
    set role authenticated;
    select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
    insert into public.trackers(id,user_id,name,type,target) values('22222222-2222-4222-8222-222222222222',auth.uid(),'Legacy habit','habit',1);
    select public.record_log('22222222-2222-4222-8222-222222222222',current_date,1,'33333333-3333-4333-8333-333333333333');
    reset role;
    create table public.migration_snapshot as select to_jsonb(l) as original from public.tracker_logs l;
    ${migrations(extension)}
    do $$ begin
      if (select count(*) from public.tracker_logs) <> 1 then raise exception 'Migration lost legacy logs'; end if;
      if (select to_jsonb(l)-'details'-'template_version_id' from public.tracker_logs l) <> (select original from public.migration_snapshot) then raise exception 'Migration changed legacy progress'; end if;
      if exists(select 1 from public.tracker_logs where details<>'{}'::jsonb or template_version_id is not null) then raise exception 'Invalid legacy defaults'; end if;
    end $$;
    set role authenticated;
    select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
    select public.record_log('22222222-2222-4222-8222-222222222222',current_date,1,'44444444-4444-4444-8444-444444444444');
    update public.tracker_logs set value=1 where id='33333333-3333-4333-8333-333333333333';
    select public.publish_activity_template(p_name=>'Generic notes',p_fields=>'[{"key":"notes","label":"Notes","type":"text"}]');
    reset role;
    do $$ begin
      if (select count(*) from public.tracker_logs) <> 1 then raise exception 'Legacy idempotency changed'; end if;
      if (select count(*) from public.activity_template_versions) <> 1 then raise exception 'Template publication failed'; end if;
    end $$;
    ${readFileSync("tests/migrations/mcp-authorization.sql", "utf8")}
    ${readFileSync("tests/migrations/mcp-gateway.sql", "utf8")}
    ${readFileSync("tests/migrations/agent-management.sql", "utf8")}
  `,
  );
  console.log(
    `Passed: ${files.length} migrations replayed; pre-upgrade log unchanged; legacy RPC, edits, template publication and OAuth RLS boundaries work.`,
  );
} finally {
  if (created) sql("postgres", `drop database ${database};`);
}
