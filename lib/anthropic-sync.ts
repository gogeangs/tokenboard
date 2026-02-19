import { ConnectionStatus } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { internalErrorLog } from "@/lib/errors";
import { startOfDayUtc } from "@/lib/date";

type AnthropicCostResponse = {
  data?: Array<{
    starting_at?: string;
    ending_at?: string;
    results?: Array<{
      workspace_id?: string | null;
      description?: string | null;
      currency?: string | null;
      amount?: number | string | { value?: number | string };
      amount_cents?: number;
      cost_usd?: number;
    }>;
  }>;
  has_more?: boolean;
  next_page?: string | null;
};

type AnthropicCostResult = {
  workspace_id?: string | null;
  description?: string | null;
  currency?: string | null;
  amount?: number | string | { value?: number | string };
  amount_cents?: number;
  cost_usd?: number;
};

type AnthropicUsageResponse = {
  data?: Array<{
    starting_at?: string;
    ending_at?: string;
    results?: Array<{
      workspace_id?: string | null;
      model?: string | null;
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    }>;
  }>;
  has_more?: boolean;
  next_page?: string | null;
};

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_PAGES = 100;
const SYNC_BATCH_SIZE = 5;

function toAmount(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "object" && value !== null && "value" in value) {
    return toAmount((value as { value?: unknown }).value);
  }
  return 0;
}

function extractCostAmount(result: AnthropicCostResult): number {
  if (typeof result.cost_usd === "number") return result.cost_usd;
  if (typeof result.amount_cents === "number") return result.amount_cents / 100;
  return toAmount(result.amount);
}

async function anthropicFetch<T>(path: string, apiKey: string, params: URLSearchParams): Promise<T> {
  const res = await fetch(`${ANTHROPIC_BASE}${path}?${params.toString()}`, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION
    },
    cache: "no-store"
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  return (await res.json()) as T;
}

async function fetchAllAnthropicCost(apiKey: string, startAt: string, endAt: string) {
  let page: string | null = null;
  let pageCount = 0;
  const buckets: NonNullable<AnthropicCostResponse["data"]> = [];

  while (true) {
    const params = new URLSearchParams({
      starting_at: startAt,
      ending_at: endAt,
      bucket_width: "1d"
    });
    params.append("group_by[]", "workspace_id");
    params.append("group_by[]", "description");
    if (page) params.set("page", page);

    const data = await anthropicFetch<AnthropicCostResponse>("/organizations/cost_report", apiKey, params);
    buckets.push(...(data.data ?? []));

    page = data.has_more ? data.next_page ?? null : null;
    pageCount++;
    if (!page || pageCount >= MAX_PAGES) break;
  }

  return buckets;
}

async function fetchAllAnthropicUsage(apiKey: string, startAt: string, endAt: string) {
  let page: string | null = null;
  let pageCount = 0;
  const buckets: NonNullable<AnthropicUsageResponse["data"]> = [];

  while (true) {
    const params = new URLSearchParams({
      starting_at: startAt,
      ending_at: endAt,
      bucket_width: "1d"
    });
    params.append("group_by[]", "workspace_id");
    params.append("group_by[]", "model");
    if (page) params.set("page", page);

    const data = await anthropicFetch<AnthropicUsageResponse>("/organizations/usage_report/messages", apiKey, params);
    buckets.push(...(data.data ?? []));

    page = data.has_more ? data.next_page ?? null : null;
    pageCount++;
    if (!page || pageCount >= MAX_PAGES) break;
  }

  return buckets;
}

export async function syncWorkspaceAnthropic(workspaceId: string, days = 30): Promise<void> {
  const connection = await prisma.anthropicConnection.findUnique({ where: { workspaceId } });
  if (!connection) return;

  let apiKey = "";
  try {
    apiKey = decryptSecret(connection.adminKeyEnc);
  } catch (error) {
    await prisma.anthropicConnection.update({
      where: { workspaceId },
      data: {
        status: ConnectionStatus.DEGRADED,
        lastError: "Failed to decrypt Anthropic key"
      }
    });
    internalErrorLog("anthropic.decrypt", error);
    return;
  }

  const now = new Date();
  const utcToday = startOfDayUtc(now);
  const start = new Date(utcToday.getTime() - days * 24 * 60 * 60 * 1000);
  const endExclusive = new Date(utcToday.getTime() + 24 * 60 * 60 * 1000);

  try {
    const [costBuckets, usageBuckets] = await Promise.all([
      fetchAllAnthropicCost(apiKey, start.toISOString(), endExclusive.toISOString()),
      fetchAllAnthropicUsage(apiKey, start.toISOString(), endExclusive.toISOString())
    ]);

    await prisma.$transaction(async (tx) => {
      for (const bucket of costBuckets) {
        if (!bucket.starting_at) continue;
        const day = startOfDayUtc(new Date(bucket.starting_at));

        for (const result of bucket.results ?? []) {
          const amount = extractCostAmount(result);
          const projectId = `anthropic:${result.workspace_id ?? ""}`;
          const lineItem = `anthropic:${result.description ?? "usage"}`;
          const currency = (result.currency ?? "usd").toLowerCase();

          await tx.dailyCost.upsert({
            where: {
              workspaceId_date_projectId_lineItem: {
                workspaceId,
                date: day,
                projectId,
                lineItem
              }
            },
            create: {
              workspaceId,
              date: day,
              projectId,
              lineItem,
              currency,
              value: amount
            },
            update: {
              currency,
              value: amount
            }
          });
        }
      }

      for (const bucket of usageBuckets) {
        if (!bucket.starting_at) continue;
        const day = startOfDayUtc(new Date(bucket.starting_at));

        for (const result of bucket.results ?? []) {
          const inputTokens = BigInt(result.input_tokens ?? 0);
          const outputTokens = BigInt(result.output_tokens ?? 0);
          const cacheCreationTokens = BigInt(result.cache_creation_input_tokens ?? 0);
          const cacheReadTokens = BigInt(result.cache_read_input_tokens ?? 0);
          const totalTokens = inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens;

          await tx.dailyUsageCompletions.upsert({
            where: {
              workspaceId_date_projectId_userId_apiKeyId_model_batch_serviceTier: {
                workspaceId,
                date: day,
                projectId: `anthropic:${result.workspace_id ?? ""}`,
                userId: "",
                apiKeyId: "",
                model: `anthropic:${result.model ?? "unknown"}`,
                batch: "",
                serviceTier: ""
              }
            },
            create: {
              workspaceId,
              date: day,
              projectId: `anthropic:${result.workspace_id ?? ""}`,
              userId: "",
              apiKeyId: "",
              model: `anthropic:${result.model ?? "unknown"}`,
              batch: "",
              serviceTier: "",
              inputTokens,
              outputTokens,
              totalTokens
            },
            update: {
              inputTokens,
              outputTokens,
              totalTokens
            }
          });
        }
      }

      await tx.anthropicConnection.update({
        where: { workspaceId },
        data: {
          status: ConnectionStatus.OK,
          lastSyncAt: new Date(),
          lastError: null
        }
      });
    });
  } catch (error) {
    await prisma.anthropicConnection.update({
      where: { workspaceId },
      data: {
        status: ConnectionStatus.DEGRADED,
        lastError: error instanceof Error ? error.message.slice(0, 400) : "Anthropic sync failed",
        lastSyncAt: new Date()
      }
    });
    internalErrorLog("anthropic.sync", error);
  }
}

export async function syncAllAnthropicWorkspaces(days = 30): Promise<{ total: number }> {
  const connections = await prisma.anthropicConnection.findMany({
    select: { workspaceId: true }
  });

  for (let i = 0; i < connections.length; i += SYNC_BATCH_SIZE) {
    const batch = connections.slice(i, i + SYNC_BATCH_SIZE);
    await Promise.all(batch.map((item) => syncWorkspaceAnthropic(item.workspaceId, days)));
  }

  return { total: connections.length };
}
