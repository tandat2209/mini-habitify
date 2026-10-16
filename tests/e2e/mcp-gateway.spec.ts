import { test, expect, type Page } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import pg from "pg";
import { encrypt, decrypt } from "../../src/features/mcp/gateway/security";
const receiver = createServer((_request, response) =>
  response.end("Connected"),
);
test.beforeAll(async () => {
  await new Promise<void>((resolve) =>
    receiver.listen(45679, "127.0.0.1", resolve),
  );
});
test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    receiver.close((error) => (error ? reject(error) : resolve())),
  );
});
process.loadEnvFile(".env.local");
test.use({ serviceWorkers: "block" });
const callback = "http://127.0.0.1:45679/callback";
async function connect(page: Page, write = true, wrongVerifier = false) {
  const metadata = await (
    await page.request.get("/.well-known/oauth-authorization-server")
  ).json();
  expect(metadata.scopes_supported).toEqual([
    "tracking:read",
    "tracking:write",
  ]);
  expect(metadata).not.toHaveProperty("userinfo_endpoint");
  const registration = await page.request.post(metadata.registration_endpoint, {
    data: {
      client_name: "Gateway test assistant",
      redirect_uris: [callback],
      token_endpoint_auth_method: "none",
    },
  });
  expect(registration.status(), await registration.text()).toBe(201);
  const { client_id } = await registration.json();
  const verifier = randomBytes(32).toString("base64url");
  const resource = new URL("/mcp", page.url()).href;
  const params = new URLSearchParams({
    client_id,
    redirect_uri: callback,
    response_type: "code",
    resource,
    state: "outer-state",
    scope: "tracking:read tracking:write",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  const begin = await page.request.get(
    `${metadata.authorization_endpoint}?${params}`,
    { maxRedirects: 0 },
  );
  expect(begin.status(), await begin.text()).toBe(302);
  const consent = new URL(begin.headers().location);
  expect(consent.pathname).toBe("/oauth/consent");
  await page.goto(consent.href);
  await expect(
    page.getByRole("heading", { name: "Connect your assistant" }),
  ).toBeVisible();
  await page.getByText("Connection details", { exact: true }).click();
  await expect(page.getByText(callback, { exact: true })).toBeVisible();
  await expect(
    page.getByText("tracking:read tracking:write", { exact: true }),
  ).toBeVisible();
  if (write)
    await page.screenshot({
      path: "/tmp/mini-habitify-gateway-consent-desktop.png",
      fullPage: true,
    });
  if ((page.viewportSize()?.width ?? 1000) < 500) {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "/tmp/mini-habitify-gateway-consent-mobile.png",
      fullPage: true,
    });
  }
  if (write)
    await page
      .getByLabel(
        "Allow creating and managing trackers, templates, and check-ins",
      )
      .check();
  await page.getByRole("button", { name: "Allow access", exact: true }).click();
  await expect(page).toHaveURL(/45679\/callback\?code=/);
  const result = new URL(page.url());
  expect(result.searchParams.get("state")).toBe("outer-state");
  expect(result.searchParams.get("iss")).toBe(metadata.issuer);
  const form = {
    grant_type: "authorization_code",
    client_id,
    redirect_uri: callback,
    resource,
    code: result.searchParams.get("code")!,
    code_verifier: wrongVerifier ? "x".repeat(43) : verifier,
  };
  const response = await page.request.post(metadata.token_endpoint, { form });
  if (wrongVerifier) {
    expect(response.status()).toBe(400);
    expect(
      (
        await page.request.post(metadata.token_endpoint, {
          form: { ...form, code_verifier: verifier },
        })
      ).status(),
    ).toBe(400);
    return null;
  }
  expect(response.ok(), await response.text()).toBe(true);
  const token = await response.json();
  expect(token.id_token).toBeUndefined();
  expect(token.access_token).toMatch(/^mh_a_/);
  expect(token.refresh_token).toMatch(/^mh_r_/);
  expect(token.scope).toBe(
    write ? "tracking:read tracking:write" : "tracking:read",
  );
  expect(
    (await page.request.post(metadata.token_endpoint, { form })).status(),
  ).toBe(400);
  return {
    ...token,
    client_id,
    resource,
    token_endpoint: metadata.token_endpoint,
  };
}
async function signup(page: Page) {
  await page.goto("/signup");
  await page
    .getByLabel("Email address")
    .fill(`gateway-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("playwright-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/today/);
}
async function rpc(
  page: Page,
  token: string,
  name: string,
  args: object = {},
  timeout = 30000,
) {
  return page.request.post("/mcp", {
    timeout,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
    },
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    },
  });
}
test("gateway opaque tokens, RLS, refresh rotation and disconnect", async ({
  page,
}) => {
  test.setTimeout(90000);
  await signup(page);
  let token = (await connect(page))!;
  const db = new pg.Client({
    connectionString: process.env.MCP_GATEWAY_DATABASE_URL,
  });
  await db.connect();
  try {
    const { rows } = await db.query<{
      id: string;
      credentials: string;
      access_hash: string;
      refresh_hash: string;
    }>(
      `select g.id,g.credentials,t.access_hash,t.refresh_hash from mcp_gateway.grants g join mcp_gateway.tokens t on t.grant_id=g.id where g.client_id=$1`,
      [token.client_id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].access_hash === token.access_token).toBe(false);
    expect(rows[0].refresh_hash === token.refresh_token).toBe(false);
    const credentials = decrypt(
      rows[0].credentials,
      process.env.MCP_GATEWAY_ENCRYPTION_KEY!,
    ) as { access_token: string; refresh_token: string; expires_at: number };
    expect(rows[0].credentials.includes(credentials.refresh_token)).toBe(false);
    // Force expiry to exercise the real Supabase refresh flow behind the opaque token.
    await db.query("update mcp_gateway.grants set credentials=$1 where id=$2", [
      encrypt(
        { ...credentials, expires_at: 0 },
        process.env.MCP_GATEWAY_ENCRYPTION_KEY!,
      ),
      rows[0].id,
    ]);
    expect(
      (await rpc(page, token.access_token, "list_trackers")).status(),
    ).toBe(200);
    const refreshed = await db.query<{ credentials: string }>(
      "select credentials from mcp_gateway.grants where id=$1",
      [rows[0].id],
    );
    const rotated = decrypt(
      refreshed.rows[0].credentials,
      process.env.MCP_GATEWAY_ENCRYPTION_KEY!,
    ) as { refresh_token: string };
    expect(rotated.refresh_token === credentials.refresh_token).toBe(false);
  } finally {
    await db.end();
  }
  const auth = await page.request.put(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        Authorization: `Bearer ${token.access_token}`,
      },
      data: { data: { gateway_escalation: true } },
    },
  );
  expect(auth.ok()).toBe(false);
  const created = await rpc(page, token.access_token, "create_tracker", {
    name: "Gateway persisted tracker",
    type: "counter",
    target: 5,
  });
  expect(created.ok(), await created.text()).toBe(true);
  const body = await created.json();
  expect(body.result.isError).not.toBe(true);
  await page.goto("/today");
  await expect(
    page.getByText("Gateway persisted tracker", { exact: true }).first(),
  ).toBeVisible();
  const form = {
    grant_type: "refresh_token",
    client_id: token.client_id,
    resource: token.resource,
    refresh_token: token.refresh_token,
  };
  expect(
    (
      await page.request.post(token.token_endpoint, {
        form: { ...form, scope: "openid" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post(token.token_endpoint, {
        form: { ...form, resource: "https://wrong.example/mcp" },
      })
    ).status(),
  ).toBe(400);
  const refreshed = await page.request.post(token.token_endpoint, { form });
  expect(refreshed.ok(), await refreshed.text()).toBe(true);
  const previous = token.access_token;
  token = { ...token, ...(await refreshed.json()) };
  expect((await rpc(page, previous, "list_trackers")).status()).toBe(401);
  expect((await rpc(page, token.access_token, "list_trackers")).status()).toBe(
    200,
  );
  await page.goto("/settings/connections");
  await page
    .getByRole("button", { name: /Disconnect Gateway test assistant/ })
    .click();
  await expect(
    page.getByRole("button", { name: /Disconnect Gateway test assistant/ }),
  ).toHaveCount(0);
  expect([401, 403]).toContain(
    (await rpc(page, token.access_token, "list_trackers")).status(),
  );
  expect(
    (
      await page.request.post(token.token_endpoint, {
        form: { ...form, refresh_token: token.refresh_token },
      })
    ).status(),
  ).toBe(400);
});
test("gateway read-only consent and PKCE rejection", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signup(page);
  const token = (await connect(page, false))!;
  const isolated = await rpc(page, token.access_token, "list_trackers");
  expect(JSON.stringify(await isolated.json())).not.toContain(
    "Gateway persisted tracker",
  );
  const denied = await rpc(page, token.access_token, "create_tracker", {
    name: "Forbidden",
    type: "habit",
  });
  expect((await denied.json()).result.isError).toBe(true);
  const placeholder = crypto.randomUUID();
  for (const [name, args] of [
    [
      "create_template",
      { name: "Forbidden", fields: [{ key: "n", label: "N", type: "text" }] },
    ],
    [
      "update_template",
      {
        template_id: placeholder,
        expected_version_id: placeholder,
        name: "Forbidden",
      },
    ],
    ["delete_template", { template_id: placeholder }],
    ["update_tracker", { tracker_id: placeholder, name: "Forbidden" }],
    ["update_checkin", { checkin_id: placeholder, value: 2 }],
  ] as const) {
    expect(
      (await (await rpc(page, token.access_token, name, args)).json()).result
        .isError,
    ).toBe(true);
  }
  await page.goto("/today");
  await connect(page, false, true);
});

test("gateway refresh-token reuse invalidates the connection", async ({
  page,
}) => {
  await signup(page);
  const token = (await connect(page, false))!;
  const form = {
    grant_type: "refresh_token",
    client_id: token.client_id,
    resource: token.resource,
    refresh_token: token.refresh_token,
  };
  const refreshed = await page.request.post(token.token_endpoint, { form });
  expect(refreshed.ok()).toBe(true);
  const next = await refreshed.json();
  expect((await rpc(page, next.access_token, "list_trackers")).status()).toBe(
    200,
  );
  expect(
    (await page.request.post(token.token_endpoint, { form })).status(),
  ).toBe(400);
  expect((await rpc(page, next.access_token, "list_trackers")).status()).toBe(
    401,
  );
});
test("gateway rejects forged requests, unsafe redirects and cross-origin consent", async ({
  page,
  baseURL,
}) => {
  await signup(page);
  const registration = await page.request.post("/oauth/mcp/register", {
    data: { redirect_uris: [callback], token_endpoint_auth_method: "none" },
  });
  const { client_id } = await registration.json();
  const params = new URLSearchParams({
    client_id,
    redirect_uri: callback,
    response_type: "code",
    resource: `${baseURL}/mcp`,
    state: "state",
    scope: "tracking:read",
    code_challenge: "a".repeat(43),
    code_challenge_method: "S256",
  });
  for (const [key, value] of [
    ["redirect_uri", "https://evil.example/callback"],
    ["scope", "openid email offline_access"],
    ["code_challenge_method", "plain"],
    ["resource", "https://evil.example/mcp"],
  ]) {
    const invalid = new URLSearchParams(params);
    invalid.set(key, value);
    expect(
      (
        await page.request.get(`/oauth/mcp/authorize?${invalid}`, {
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(400);
  }
  expect(
    (await rpc(page, `mh_a_${"a".repeat(43)}`, "list_trackers")).status(),
  ).toBe(401);
  expect(
    (
      await page.request.get(
        `/oauth/mcp/callback?code=x&state=${"a".repeat(43)}`,
      )
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post("/oauth/mcp/decision", {
        headers: { Origin: "https://evil.example" },
        data: {
          authorizationId: "a".repeat(32),
          decision: "allow",
          canWrite: true,
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/oauth/mcp/decision", {
        headers: { Origin: baseURL!, "Content-Type": "application/json" },
        data: "{",
      })
    ).status(),
  ).toBe(400);
});

test("agent manages DDIA template, tracker and historical check-ins through MCP", async ({
  page,
}) => {
  test.setTimeout(120000);
  await signup(page);
  const token = (await connect(page))!;
  async function call(name: string, args: object = {}, error = false) {
    // A stale-version conflict must return promptly instead of retriggering transaction retries.
    const response = await rpc(
      page,
      token.access_token,
      name,
      args,
      name === "update_template" && error ? 5000 : 30000,
    ).catch(() => {
      throw new Error(`MCP tool ${name} did not respond promptly.`);
    });
    const body = await response.json();
    expect(body.error, JSON.stringify(body)).toBeUndefined();
    expect(body.result.isError === true, JSON.stringify(body)).toBe(error);
    return JSON.parse(body.result.content[0].text);
  }
  const created = await call("create_template", {
    name: "Book Reading",
    fields: [
      { key: "chapters", label: "Chapters read", type: "text", required: true },
      { key: "takeaway", label: "What I learned", type: "textarea" },
      {
        key: "understanding",
        label: "Understanding",
        type: "rating",
        config: { min: 1, max: 5 },
      },
    ],
  });
  const templateId = created.templateId;
  const original = await call("get_template", { template_id: templateId });
  const versionId = original.version.id;
  expect(original.version.fields).toHaveLength(3);
  const tracker = await call("create_tracker", {
    name: "Read DDIA",
    type: "habit",
    target: 3,
    goal_period: "weekly",
    activity_template_id: templateId,
  });
  const trackerId = tracker.trackerId;
  const recorded = await call("record_checkin", {
    tracker_id: trackerId,
    value: 1,
    request_id: crypto.randomUUID(),
    template_version_id: versionId,
    details: {
      chapters: "Chapter 7",
      takeaway: "Transaction isolation",
      understanding: 4,
    },
  });
  await call(
    "record_checkin",
    {
      tracker_id: trackerId,
      value: 1,
      request_id: crypto.randomUUID(),
      template_version_id: versionId,
      details: { chapters: "Chapter 7", understanding: 6 },
    },
    true,
  );
  await call("update_template", {
    template_id: templateId,
    expected_version_id: versionId,
    upsert_fields: [
      {
        key: "questions",
        label: "Questions I still have",
        type: "textarea",
        required: true,
      },
    ],
  });
  const updated = await call("get_template", { template_id: templateId });
  expect(updated.version.fields).toHaveLength(4);
  expect(updated.version.id).not.toBe(versionId);
  await call(
    "update_template",
    {
      template_id: templateId,
      expected_version_id: versionId,
      name: "Stale write",
    },
    true,
  );
  await call("update_checkin", {
    checkin_id: recorded.logId,
    details: { understanding: 5 },
  });
  await call(
    "update_checkin",
    {
      checkin_id: recorded.logId,
      details: { questions: "Uses the new schema" },
    },
    true,
  );
  const history = await call("get_history", { tracker_id: trackerId });
  expect(history.logs[0].details).toEqual({
    chapters: "Chapter 7",
    takeaway: "Transaction isolation",
    understanding: 5,
  });
  expect(history.logs[0].template_version_id).toBe(versionId);
  await call("update_tracker", {
    tracker_id: trackerId,
    name: "DDIA study",
    target: 4,
  });
  const config = await call("get_tracker", { tracker_id: trackerId });
  expect(config.tracker).toMatchObject({
    name: "DDIA study",
    target: 4,
    goal_period: "weekly",
    activity_template_id: templateId,
    schedule: [0, 1, 2, 3, 4, 5, 6],
  });
  expect((await call("list_trackers")).trackers).toHaveLength(1);
  await call("delete_template", { template_id: templateId });
  expect((await call("list_templates")).templates).toHaveLength(0);
  expect(
    (await call("list_templates", { include_archived: true })).templates,
  ).toHaveLength(1);
  expect(
    (await call("get_template", { template_id: templateId })).template
      .archived_at,
  ).toBeTruthy();
  expect(
    (await call("get_history", { tracker_id: trackerId })).logs[0].details
      .understanding,
  ).toBe(5);
  await call(
    "create_tracker",
    {
      name: "Archived template",
      type: "habit",
      activity_template_id: templateId,
    },
    true,
  );
  await call("update_tracker", {
    tracker_id: trackerId,
    activity_template_id: null,
  });
  expect(
    (await call("get_tracker", { tracker_id: trackerId })).template,
  ).toBeNull();
  await page.goto("/today");
  await expect(
    page.getByRole("heading", { name: "DDIA study", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "DDIA study", exact: true }),
  ).toBeVisible();
});
