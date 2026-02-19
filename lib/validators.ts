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
