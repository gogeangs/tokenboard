import { z } from "zod";

export const authSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128)
});

export const connectOpenAISchema = z.object({
  workspaceId: z.string().min(1),
  apiKey: z.string().min(20),
  mode: z.enum(["organization", "personal"]).default("organization")
});

export const budgetSchema = z.object({
  workspaceId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().positive(),
  currency: z.string().min(3).max(8).default("usd")
});

export const summaryQuerySchema = z.object({
  workspaceId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/)
});

export const trendQuerySchema = z.object({
  workspaceId: z.string().min(1),
  from: z.string().datetime(),
  to: z.string().datetime()
});

export const breakdownQuerySchema = z.object({
  workspaceId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  by: z.enum(["project", "line_item", "model"])
});
