import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
const authUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const callback = "http://127.0.0.1:45678/callback";
async function connect(
  page: Page,
  request: APIRequestContext,
  write: boolean,
  existingClient?: string,
) {
  const registration = await request.post(`${authUrl}/oauth/clients/register`, {
    data: {
      client_name: write ? "Test assistant" : "Read only assistant",
      redirect_uris: [callback],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
  });
  expect(registration.ok(), await registration.text()).toBeTruthy();
  const { client_id: registeredId } = await registration.json();
  const client_id = existingClient ?? registeredId;
  const verifier = randomBytes(32).toString("base64url");
  const resource = `${new URL(page.url()).origin}/mcp`;
  const params = new URLSearchParams({
    client_id,
    redirect_uri: callback,
    response_type: "code",
    scope: "email",
    state: "random-test-state",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    resource,
    prompt: "consent",
  });
  await page.route(`${callback}**`, (route) =>
    route.fulfill({ body: "Connected" }),
  );
  const authResponse = await request.get(
    `${authUrl}/oauth/authorize?${params}`,
    { maxRedirects: 0 },
  );
  const consent = new URL(authResponse.headers().location);
  await page.goto(
    `${resource.slice(0, -4)}${consent.pathname}${consent.search}`,
  );
  await expect(
    page.getByRole("heading", { name: "Connect your assistant" }),
  ).toBeVisible();
  if (write)
    await page
      .getByLabel("Allow creating and managing trackers and check-ins")
      .check();
  await page.getByRole("button", { name: "Allow access", exact: true }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:45678\/callback\?code=/);
  const result = new URL(page.url());
  expect(result.searchParams.get("state")).toBe("random-test-state");
  const tokenResponse = await request.post(`${authUrl}/oauth/token`, {
    form: {
      grant_type: "authorization_code",
      client_id,
      redirect_uri: callback,
      code: result.searchParams.get("code")!,
      code_verifier: verifier,
      resource,
    },
  });
  expect(tokenResponse.ok(), await tokenResponse.text()).toBeTruthy();
  return { ...(await tokenResponse.json()), client_id, resource } as {
    access_token: string;
    refresh_token: string;
    id_token?: string;
    client_id: string;
    resource: string;
  };
}
async function rpc(
  request: APIRequestContext,
  token: string,
  method: string,
  params: object = {},
) {
  return request.post("/mcp", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-03-26",
    },
    data: { jsonrpc: "2.0", id: 1, method, params },
  });
}
test("OAuth consent → MCP tracker/check-in → real RLS → revoke", async ({
  page,
  request,
  baseURL,
}) => {
  test.setTimeout(90000);
  await page.goto("/signup");
  await page
    .getByLabel("Email address")
    .fill(`mcp-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("playwright-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/today/);
  let token = await connect(page, request, true);
  const refreshed = await request.post(`${authUrl}/oauth/token`, {
    form: {
      grant_type: "refresh_token",
      client_id: token.client_id,
      refresh_token: token.refresh_token,
    },
  });
  expect(refreshed.ok(), await refreshed.text()).toBe(true);
  token = { ...token, ...(await refreshed.json()) };
  const escalation = await request.post(`${authUrl}/oauth/token`, {
    form: {
      grant_type: "refresh_token",
      client_id: token.client_id,
      refresh_token: token.refresh_token,
      scope: "openid email",
    },
  });
  if (escalation.ok()) {
    const rotated = await escalation.json();
    expect(rotated.id_token).toBeUndefined();
    token = { ...token, ...rotated };
  } else expect(escalation.status()).toBe(400);
  // Generic Supabase refresh must not turn an OAuth grant into a browser session.
  const genericRefresh = await request.post(
    `${authUrl}/token?grant_type=refresh_token`,
    {
      headers: { apikey: publicKey },
      data: { refresh_token: token.refresh_token },
    },
  );
  if (genericRefresh.ok()) {
    const rotated = await genericRefresh.json();
    const genericClaims = JSON.parse(
      Buffer.from(rotated.access_token.split(".")[1], "base64url").toString(),
    );
    expect(genericClaims.client_id).toBe(token.client_id);
    expect(genericClaims.session_id).toBe(genericClaims.mcp_grant_id);
    expect(rotated.id_token).toBeUndefined();
    token = { ...token, ...rotated };
  } else expect([400, 401, 403]).toContain(genericRefresh.status());
  const claims = JSON.parse(
    Buffer.from(token.access_token.split(".")[1], "base64url").toString(),
  );
  expect(claims.aud).toContain(token.resource);
  expect(claims.client_id).toBe(token.client_id);
  expect(claims.mcp_grant_id).toBeTruthy();
  expect(claims.session_id).toBe(claims.mcp_grant_id);
  const parts = token.access_token.split(".");
  parts[1] = Buffer.from(
    JSON.stringify({ ...claims, mcp_grant_id: crypto.randomUUID() }),
  ).toString("base64url");
  expect((await rpc(request, parts.join("."), "tools/list")).status()).toBe(
    401,
  );

  expect(
    (
      await request.get(`${authUrl}/user`, {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          apikey: publicKey,
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await rpc(request, token.access_token, "initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
      })
    ).ok(),
  ).toBeTruthy();
  const tools = await (
    await rpc(request, token.access_token, "tools/list")
  ).json();
  expect(tools.result.tools.map((t: { name: string }) => t.name)).toContain(
    "record_check_in",
  );
  const created = await (
    await rpc(request, token.access_token, "tools/call", {
      name: "create_tracker",
      arguments: { name: "From my assistant", type: "habit" },
    })
  ).json();
  expect(created.result.isError, JSON.stringify(created)).not.toBe(true);
  const trackerId = JSON.parse(created.result.content[0].text).trackerId;
  expect(trackerId).toBeTruthy();
  const checkin = {
    name: "record_check_in",
    arguments: {
      tracker_id: trackerId,
      value: 1,
      request_id: crypto.randomUUID(),
    },
  };
  const saved = await (
    await rpc(request, token.access_token, "tools/call", checkin)
  ).json();
  expect(saved.result.isError, JSON.stringify(saved)).not.toBe(true);
  const retry = await (
    await rpc(request, token.access_token, "tools/call", checkin)
  ).json();
  expect(retry.result.content).toEqual(saved.result.content);
  const accountChange = await request.put(`${authUrl}/user`, {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      apikey: publicKey,
    },
    data: { data: { mcp_should_not_write: true } },
  });
  expect(accountChange.status()).toBe(403);
  expect(token.id_token).toBeUndefined();
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publicKey,
    { accessToken: async () => token.access_token },
  );
  expect(
    (await client.from("tracker_logs").select().eq("tracker_id", trackerId))
      .data,
  ).toHaveLength(1);
  expect((await client.from("user_preferences").select()).data).toEqual([]);
  expect((await client.from("mcp_connections").select()).data).toEqual([]);
  expect(
    (
      await client
        .from("profiles")
        .update({ timezone: "UTC" })
        .eq("id", claims.sub)
        .select()
    ).data,
  ).toEqual([]);
  const other = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, publicKey, {
    auth: { persistSession: false },
  });
  const otherUser = await other.auth.signUp({
    email: `mcp-other-${crypto.randomUUID()}@example.com`,
    password: "playwright-test-password",
  });
  const foreign = await other
    .from("trackers")
    .insert({
      user_id: otherUser.data.user!.id,
      name: "Private",
      type: "habit",
      target: 1,
    })
    .select()
    .single();
  expect(
    (await client.from("trackers").select().eq("id", foreign.data!.id)).data,
  ).toEqual([]);
  const foreignCheck = await (
    await rpc(request, token.access_token, "tools/call", {
      name: "record_check_in",
      arguments: {
        ...checkin.arguments,
        tracker_id: foreign.data!.id,
        request_id: crypto.randomUUID(),
      },
    })
  ).json();
  expect(foreignCheck.result.isError).toBe(true);
  await page.goto(`${baseURL}/today`);
  await expect(
    page.getByRole("heading", { name: "From my assistant", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Connected apps", exact: true }).click();
  await expect(page.getByText("Test assistant", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Disconnect Test assistant" }).click();
  await expect(page.getByText("No connected apps yet.")).toBeVisible();
  expect((await rpc(request, token.access_token, "tools/list")).status()).toBe(
    403,
  );
  expect((await client.from("trackers").select()).data).toEqual([]);
  const refresh = await request.post(`${authUrl}/oauth/token`, {
    form: {
      grant_type: "refresh_token",
      client_id: token.client_id,
      refresh_token: token.refresh_token,
    },
  });
  expect(refresh.ok()).toBeFalsy();
  // First-party sessions are never accepted as MCP credentials.
  const ordinary = otherUser.data.session!.access_token;
  expect((await rpc(request, ordinary, "tools/list")).status()).toBe(401);
  expect((await request.post("/mcp", { data: {} })).status()).toBe(401);
  const read = await connect(page, request, false, token.client_id);
  expect((await rpc(request, token.access_token, "tools/list")).status()).toBe(
    403,
  );
  const denied = await (
    await rpc(request, read.access_token, "tools/call", {
      name: "create_tracker",
      arguments: { name: "Not allowed", type: "habit" },
    })
  ).json();
  expect(denied.result.isError).toBe(true);
  const readClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publicKey,
    { accessToken: async () => read.access_token },
  );
  expect(
    (
      await readClient.from("trackers").insert({
        user_id: claims.sub,
        name: "Direct bypass",
        type: "habit",
        target: 1,
      })
    ).error?.code,
  ).toBe("42501");
  expect((await readClient.from("trackers").select()).data).toHaveLength(1);
  expect(
    (
      await readClient.rpc("publish_activity_template", {
        p_name: "Forbidden",
        p_fields: [{ key: "notes", label: "Notes", type: "text" }],
      })
    ).error,
  ).not.toBeNull();
  expect(
    (
      await request.post("/mcp", {
        headers: {
          Authorization: `Bearer ${read.access_token}`,
          Origin: "https://untrusted.example",
        },
        data: {},
      })
    ).status(),
  ).toBe(403);
  const metadata = await (
    await request.get("/.well-known/oauth-protected-resource/mcp")
  ).json();
  expect(metadata.resource).toBe(`${baseURL}/mcp`);
  expect(metadata.scopes_supported).toEqual(["email"]);
  const tooLarge = await request.post("/mcp", {
    headers: {
      Authorization: `Bearer ${read.access_token}`,
      Accept: "application/json, text/event-stream",
    },
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      padding: "a".repeat(65536),
    },
  });
  expect(tooLarge.status()).toBe(413);
});

test("MCP validates details and preserves original template versions", async ({
  page,
  request,
}) => {
  const email = `mcp-details-${crypto.randomUUID()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("playwright-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/today/);
  const owner = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, publicKey, {
    auth: { persistSession: false },
  });
  await owner.auth.signInWithPassword({
    email,
    password: "playwright-test-password",
  });
  const published = await owner.rpc("publish_activity_template", {
    p_name: "Session notes",
    p_fields: [{ key: "notes", label: "Notes", type: "text", required: false }],
  });
  expect(published.error).toBeNull();
  const templateId = published.data;
  const token = await connect(page, request, true);
  async function call(name: string, args: object) {
    const body = await (
      await rpc(request, token.access_token, "tools/call", {
        name,
        arguments: args,
      })
    ).json();
    return body.result as { isError?: boolean; content: { text: string }[] };
  }
  const created = await call("create_tracker", {
    name: "Detailed sessions",
    type: "counter",
    activity_template_id: templateId,
  });
  expect(created.isError, JSON.stringify(created)).not.toBe(true);
  const trackerId = JSON.parse(created.content[0].text).trackerId;
  const tracker = JSON.parse(
    (await call("get_tracker", { tracker_id: trackerId })).content[0].text,
  );
  const versionId = tracker.template.id;
  const args = {
    tracker_id: trackerId,
    value: 3,
    request_id: crypto.randomUUID(),
    template_version_id: versionId,
  };
  const saved = await call("record_check_in", {
    ...args,
    details: { notes: "A useful session" },
  });
  expect(saved.isError).not.toBe(true);
  const retry = await call("record_check_in", {
    ...args,
    details: { notes: "A useful session" },
  });
  expect(retry).toEqual(saved);
  expect(
    (
      await call("record_check_in", {
        ...args,
        request_id: crypto.randomUUID(),
        details: { unexpected: "no" },
      })
    ).isError,
  ).toBe(true);
  expect(
    (
      await call("record_check_in", {
        ...args,
        request_id: crypto.randomUUID(),
        details: { notes: 42 },
      })
    ).isError,
  ).toBe(true);
  expect(
    (
      await owner.rpc("publish_activity_template", {
        p_template: templateId,
        p_name: "Session notes",
        p_fields: [
          { key: "score", label: "Score", type: "number", required: false },
        ],
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await call("record_check_in", {
        ...args,
        request_id: crypto.randomUUID(),
        details: { notes: "stale" },
      })
    ).isError,
  ).toBe(true);
  expect(
    (
      await call("record_check_in", {
        tracker_id: trackerId,
        value: 2,
        request_id: crypto.randomUUID(),
      })
    ).isError,
  ).not.toBe(true);
  const history = JSON.parse(
    (await call("get_history", { tracker_id: trackerId })).content[0].text,
  );
  expect(history.logs).toHaveLength(2);
  expect(
    history.logs.find((l: { details: { notes?: string } }) => l.details.notes)
      ?.details.notes,
  ).toBe("A useful session");
  expect(
    history.template_versions.find((v: { id: string }) => v.id === versionId)
      .fields[0].label,
  ).toBe("Notes");
});

test("mobile consent preserves login and can decline without granting access", async ({
  page,
  request,
  baseURL,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const email = `mcp-consent-${crypto.randomUUID()}@example.com`;
  const owner = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, publicKey, {
    auth: { persistSession: false },
  });
  await owner.auth.signUp({ email, password: "playwright-test-password" });
  const registration = await request.post(`${authUrl}/oauth/clients/register`, {
    data: {
      client_name: "Mobile assistant",
      redirect_uris: [callback],
      token_endpoint_auth_method: "none",
    },
  });
  const { client_id } = await registration.json();
  const verifier = randomBytes(32).toString("base64url");
  const params = new URLSearchParams({
    client_id,
    redirect_uri: callback,
    response_type: "code",
    scope: "email",
    state: "decline-test",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    resource: `${baseURL}/mcp`,
  });
  await page.route(`${callback}**`, (route) =>
    route.fulfill({ body: "Declined" }),
  );
  const authResponse = await request.get(
    `${authUrl}/oauth/authorize?${params}`,
    { maxRedirects: 0 },
  );
  const consent = new URL(authResponse.headers().location);
  await page.goto(`${baseURL}${consent.pathname}${consent.search}`);
  await expect(page).toHaveURL(/\/login\?authorization_id=/);
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("playwright-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Connect your assistant" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByLabel("Allow creating and managing trackers and check-ins"),
  ).not.toBeChecked();
  const writeCheckbox = page.getByLabel(
    "Allow creating and managing trackers and check-ins",
  );
  await writeCheckbox.focus();
  await page.keyboard.press("Space");
  await expect(writeCheckbox).toBeChecked();
  await page.keyboard.press("Space");
  await expect(writeCheckbox).not.toBeChecked();
  await page.screenshot({
    path: "/tmp/mini-habitify-mcp-consent-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  await expect(page).toHaveURL(/error=access_denied/);
  expect((await owner.from("mcp_connections").select()).data).toEqual([]);
  await page.goto(`${baseURL}/settings/connections`);
  await expect(page.getByText("No connected apps yet.")).toBeVisible();
  expect(await page.getByLabel("MCP server address").inputValue()).toBe(
    `${baseURL}/mcp`,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/mini-habitify-mcp-connections-mobile.png",
    fullPage: true,
  });
});

test("OpenID requests cannot grant broader account credentials", async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto("/signup");
  await page
    .getByLabel("Email address")
    .fill(`mcp-openid-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("playwright-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/today/);
  const existing = await connect(page, request, false);
  const client_id = existing.client_id;
  const verifier = randomBytes(32).toString("base64url");
  const params = new URLSearchParams({
    client_id,
    redirect_uri: callback,
    response_type: "code",
    scope: "openid email",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  const authResponse = await request.get(
    `${authUrl}/oauth/authorize?${params}`,
    { maxRedirects: 0 },
  );
  const consent = new URL(authResponse.headers().location);
  await page.goto(`${baseURL}${consent.pathname}${consent.search}`);
  await expect(
    page.getByText(/This assistant requested unsupported scopes/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Allow access", exact: true }),
  ).toBeDisabled();
  // A modified form cannot bypass the server's scope check.
  await page.locator("#oauth-consent").evaluate((form: HTMLFormElement) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "decision";
    input.value = "allow";
    form.append(input);
    form.requestSubmit();
  });
  await expect(
    page.getByText(/This connection requires the email OAuth scope only/),
  ).toBeVisible();
  await page.goto("/settings/connections");
  await expect(
    page.getByText("Read only assistant", { exact: true }),
  ).toBeVisible();
  expect(
    (await rpc(request, existing.access_token, "tools/list")).status(),
  ).toBe(200);
});
