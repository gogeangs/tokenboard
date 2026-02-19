import { z } from "zod";

const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

export const authSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128)
});

export const connectOpenAISchema = z.object({
  workspaceId: z.string().min(1),
  apiKey: z.string().min(20),
  mode: z.enum(["organization", "personal"]).default("organization")
});

export const connectAnthropicSchema = z.object({
  workspaceId: z.string().min(1),
  apiKey: z.string().min(20)
});

export const syncWorkspaceSchema = z.object({
  workspaceId: z.string().min(1)
});

export const budgetSchema = z.object({
  workspaceId: z.string().min(1),
  month: z.string().regex(monthRegex),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3).default("usd")
});

export const summaryQuerySchema = z.object({
  workspaceId: z.string().min(1),
  month: z.string().regex(monthRegex)
});

export const trendQuerySchema = z
  .object({
    workspaceId: z.string().min(1),
    from: z.string().datetime(),
    to: z.string().datetime()
  })
  .refine((data) => new Date(data.from) < new Date(data.to), {
    message: "from must be before to"
  });

export const breakdownQuerySchema = z.object({
  workspaceId: z.string().min(1),
  month: z.string().regex(monthRegex),
  by: z.enum(["project", "line_item", "model"])
});

export const inviteMemberSchema = z.object({
  email: z.string().email().toLowerCase(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER")
});

export const changeMemberRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"])
});

export const removeMemberSchema = z.object({
  userId: z.string().min(1)
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1)
});

export const connectVertexSchema = z.object({
  workspaceId: z.string().min(1),
  serviceAccountJson: z.string().min(10),
  projectId: z.string().min(1),
  region: z.string().min(1).default("us-central1")
});

export const connectBedrockSchema = z.object({
  workspaceId: z.string().min(1),
  accessKeyId: z.string().min(16),
  secretAccessKey: z.string().min(20),
  region: z.string().min(1).default("us-east-1")
});

export const alertRuleSchema = z.object({
  workspaceId: z.string().min(1),
  type: z.enum(["BUDGET_THRESHOLD", "COST_SPIKE", "CONNECTION_STATUS"]),
  channel: z.enum(["WEBHOOK", "IN_APP"]).default("IN_APP"),
  config: z.record(z.unknown()).default({}),
  webhookUrl: z.string().url().optional(),
  enabled: z.boolean().default(true)
});

export const updateAlertRuleSchema = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
  channel: z.enum(["WEBHOOK", "IN_APP"]).optional(),
  webhookUrl: z.string().url().nullable().optional()
});

export const analyticsKeysQuerySchema = z.object({
  workspaceId: z.string().min(1),
  from: z.string().datetime(),
  to: z.string().datetime()
});

export const analyticsRatioQuerySchema = z.object({
  workspaceId: z.string().min(1),
  month: z.string().regex(monthRegex),
  groupBy: z.enum(["project", "model"])
});

export const analyticsComparisonQuerySchema = z.object({
  workspaceId: z.string().min(1),
  period: z.enum(["week", "month"]),
  month: z.string().regex(monthRegex)
});

export const forecastQuerySchema = z.object({
  workspaceId: z.string().min(1),
  month: z.string().regex(monthRegex)
});
