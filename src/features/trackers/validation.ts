import { z } from "zod";
export const themes = ["paper", "pastel", "terminal", "brutalist"] as const;
export const presentations = ["calm", "developer", "playful"] as const;
export const trackerSchema = z
  .object({
    name: z.string().trim().min(1, "Give your tracker a name.").max(80),
    description: z.string().trim().max(500),
    type: z.enum(["habit", "counter", "duration", "numeric"]),
    target: z.number().positive().max(1e9).nullable(),
    unit: z.string().trim().max(24),
    goal_period: z.enum(["daily", "weekly", "monthly"]),
    schedule: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .refine((a) => new Set(a).size === a.length),
    icon: z.enum(["spark", "book", "heart", "walk", "code", "water"]),
    color: z.enum(["sage", "peach", "lavender", "blue"]),
  })
  .superRefine((data, ctx) => {
    if (
      data.type === "habit" &&
      (data.target === null || !Number.isInteger(data.target))
    )
      ctx.addIssue({
        code: "custom",
        message: "Habits need a whole-number completion target.",
        path: ["target"],
      });
    if (
      data.type === "habit" &&
      data.goal_period === "daily" &&
      data.target !== 1
    )
      ctx.addIssue({
        code: "custom",
        message: "Daily habits have a target of one.",
        path: ["target"],
      });
  });
export const trackingDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => {
    const date = new Date(`${d}T12:00:00Z`);
    return (
      Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === d
    );
  }, "Choose a valid date.");
export const logSchema = z.object({
  tracker_id: z.uuid(),
  date: trackingDateSchema,
  value: z.number().finite().min(0).max(1e9),
  request_id: z.uuid(),
});
export const preferencesSchema = z.object({
  theme: z.enum(themes),
  layout: z.enum(["standard", "compact"]),
  presentation: z.enum(presentations),
  show_activity: z.boolean(),
});
export const authSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
  timezone: z.string().refine((t) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: t });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid timezone."),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export type TrackerInput = z.infer<typeof trackerSchema>;
