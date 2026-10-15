import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  saveTrackerWithContext,
  recordLogWithContext,
  type TrackerContext,
} from "@/features/trackers/service";
import { dateInTimezone } from "@/features/tracker-engine/engine";
import {
  trackerSchema,
  logSchema,
  trackingDateSchema,
} from "@/features/trackers/validation";
function result(data: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    ...(isError ? { isError: true } : {}),
  };
}
const pagination = {
  offset: z.number().int().min(0).max(100000).default(0),
  limit: z.number().int().min(1).max(100).default(50),
};
export function createMcpServer(context: TrackerContext, canWrite: boolean) {
  const { client, user } = context;
  const server = new McpServer({ name: "mini-habitify", version: "1.0.0" });
  server.registerTool(
    "list_trackers",
    {
      description:
        "List your trackers. Includes IDs, type, unit, schedule and template association. Durations are stored in seconds. Paginate with offset/limit.",
      inputSchema: {
        ...pagination,
        include_archived: z.boolean().default(false),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ offset, limit, include_archived }) => {
      let query = client
        .from("trackers")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at")
        .order("id")
        .range(offset, offset + limit - 1);
      if (!include_archived) query = query.is("archived_at", null);
      const { data, error } = await query;
      return error
        ? result({ error: "Could not load trackers." }, true)
        : result({
            trackers: data,
            next_offset: data.length === limit ? offset + limit : null,
          });
    },
  );
  server.registerTool(
    "get_tracker",
    {
      description:
        "Read a tracker, today's date in your timezone, and its current structured-detail fields. Read this before recording details; pass the template version ID when saving details.",
      inputSchema: { tracker_id: z.uuid() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ tracker_id }) => {
      const tracker = await client
        .from("trackers")
        .select("*")
        .eq("id", tracker_id)
        .eq("user_id", user.id)
        .single();
      if (tracker.error) return result({ error: "Tracker unavailable." }, true);
      const profile = await client
        .from("profiles")
        .select("timezone")
        .eq("id", user.id)
        .single();
      if (profile.error)
        return result({ error: "Could not load timezone." }, true);
      const template = tracker.data.activity_template_id
        ? await client
            .from("activity_templates")
            .select("*")
            .eq("id", tracker.data.activity_template_id)
            .single()
        : null;
      const version = template?.data?.current_version_id
        ? await client
            .from("activity_template_versions")
            .select("*")
            .eq("id", template.data.current_version_id)
            .single()
        : null;
      if (template?.error || version?.error)
        return result({ error: "Template unavailable." }, true);
      return result({
        tracker: tracker.data,
        today: dateInTimezone(new Date(), profile.data.timezone),
        timezone: profile.data.timezone,
        template: version?.data ?? null,
      });
    },
  );
  server.registerTool(
    "list_templates",
    {
      description:
        "List reusable activity templates. Templates define optional structured content independently of tracking metrics.",
      inputSchema: pagination,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ offset, limit }) => {
      const { data, error } = await client
        .from("activity_templates")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at")
        .order("id")
        .range(offset, offset + limit - 1);
      return error
        ? result({ error: "Could not load templates." }, true)
        : result({
            templates: data,
            next_offset: data.length === limit ? offset + limit : null,
          });
    },
  );
  server.registerTool(
    "get_history",
    {
      description:
        "Read a tracker's check-ins, newest first, with original template definitions for historical details. Use pagination; this returns raw records, not independently calculated statistics.",
      inputSchema: {
        tracker_id: z.uuid(),
        ...pagination,
        from: trackingDateSchema.optional(),
        to: trackingDateSchema.optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ tracker_id, offset, limit, from, to }) => {
      let query = client
        .from("tracker_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("tracker_id", tracker_id)
        .order("tracking_date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + limit - 1);
      if (from) query = query.gte("tracking_date", from);
      if (to) query = query.lte("tracking_date", to);
      const { data, error } = await query;
      if (error) return result({ error: "Could not load history." }, true);
      const ids = [
        ...new Set(
          data.flatMap((l) =>
            l.template_version_id ? [l.template_version_id] : [],
          ),
        ),
      ];
      const versions = ids.length
        ? await client
            .from("activity_template_versions")
            .select("*")
            .in("id", ids)
        : { data: [], error: null };
      return versions.error
        ? result({ error: "Could not load historical fields." }, true)
        : result({
            logs: data,
            template_versions: versions.data,
            next_offset: data.length === limit ? offset + limit : null,
          });
    },
  );
  server.registerTool(
    "create_tracker",
    {
      description:
        "Create a tracker after the user requests it. Habit defaults to a daily completion target of 1; counters/durations/numeric default to no target. Duration values/targets are seconds. Schedule uses Sunday=0 through Saturday=6. Does not modify existing trackers.",
      inputSchema: z
        .object(trackerSchema.shape)
        .partial()
        .required({ name: true, type: true })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      if (!canWrite)
        return result(
          {
            error:
              "This connection has read-only access. Reconnect and allow tracker/check-in management to write.",
          },
          true,
        );
      const saved = await saveTrackerWithContext(context, {
        description: "",
        target: input.type === "habit" ? 1 : null,
        unit: input.type === "duration" ? "seconds" : "",
        goal_period: "daily",
        schedule: [0, 1, 2, 3, 4, 5, 6],
        icon: "spark",
        color: "sage",
        ...input,
      });
      return result(saved, !saved.success);
    },
  );
  server.registerTool(
    "record_check_in",
    {
      description:
        "Record progress for an existing tracker. Obtain tracker ID and current template fields first. Value is 1 for a habit, seconds for duration, or the counter/measurement value. Date defaults to today in the user's timezone. Details are optional. REQUIRED request_id: generate a UUID once per intended check-in and reuse it for retries to avoid duplicate progress.",
      inputSchema: logSchema
        .omit({ date: true })
        .extend({ date: trackingDateSchema.optional() })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      if (!canWrite)
        return result({ error: "This connection has read-only access." }, true);
      const profile = await client
        .from("profiles")
        .select("timezone")
        .eq("id", user.id)
        .single();
      if (profile.error)
        return result({ error: "Could not load timezone." }, true);
      const saved = await recordLogWithContext(context, {
        ...input,
        date: input.date ?? dateInTimezone(new Date(), profile.data.timezone),
      });
      return result(saved, !saved.success);
    },
  );
  return server;
}
