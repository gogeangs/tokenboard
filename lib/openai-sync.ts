import { ConnectionStatus } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { internalErrorLog } from "@/lib/errors";
import { startOfDayUtc, toUnixSeconds } from "@/lib/date";

type OpenAICostResult = {
  data?: Array<{
    start_time: number;
    end_time: number;
    results?: Array<{
      amount?: {
        value?: number;
        currency?: string;
      };
      project_id?: string | null;
      line_item?: string | null;
    }>;
  }>;
  next_page?: string | null;
  organization_costs?: {
    buckets?: Array<{
      start_time: number;
      end_time: number;
      results: Array<{
        amount?: {
          value?: number;
          currency?: string;
        };
        project_id?: string | null;
        line_item?: string | null;
      }>;
    }>;
    next_page?: string | null;
  };
};

type OpenAIUsageResult = {
  data?: Array<{
    start_time: number;
    end_time: number;
    results?: Array<{
      project_id?: string | null;
      user_id?: string | null;
      api_key_id?: string | null;
      model?: string | null;
      batch?: boolean | null;
      service_tier?: string | null;
      input_tokens?: number;
      output_tokens?: number;
      num_model_requests?: number;
    }>;
    result?: Array<{
      project_id?: string | null;
      user_id?: string | null;
      api_key_id?: string | null;
      model?: string | null;
      batch?: boolean | null;
      service_tier?: string | null;
      input_tokens?: number;
      output_tokens?: number;
      num_model_requests?: number;
    }>;
  }>;
  next_page?: string | null;
};

const OPENAI_BASE = "https://api.openai.com/v1";

async function openAIFetch<T>(path: string, apiKey: string, params: URLSearchParams): Promise<T> {
  const res = await fetch(`${OPENAI_BASE}${path}?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    cache: "no-store"
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  return (await res.json()) as T;
}

async function fetchAllCostBuckets(apiKey: string, startTime: number, endTime: number) {
  let page: string | null = null;
  const buckets: Array<{
    start_time: number;
    end_time: number;
    results?: Array<{
      amount?: { value?: number; currency?: string };
      project_id?: string | null;
      line_item?: string | null;
    }>;
  }> = [];

  while (true) {
    const params = new URLSearchParams({
      start_time: String(startTime),
      end_time: String(endTime),
      bucket_width: "1d"
    });
    params.append("group_by", "project_id");
    params.append("group_by", "line_item");
    if (page) params.set("page", page);

    const data = await openAIFetch<OpenAICostResult>("/organization/costs", apiKey, params);
    const chunk = data.organization_costs?.buckets ?? data.data ?? [];
    buckets.push(...chunk);

    page = data.organization_costs?.next_page ?? data.next_page ?? null;
    if (!page) break;
  }

  return buckets;
}

async function fetchAllUsageBuckets(apiKey: string, startTime: number, endTime: number) {
  let page: string | null = null;
  const buckets: NonNullable<OpenAIUsageResult["data"]> = [];

  while (true) {
    const params = new URLSearchParams({
      start_time: String(startTime),
      end_time: String(endTime),
      bucket_width: "1d"
    });
    params.append("group_by", "project_id");
    params.append("group_by", "user_id");
    params.append("group_by", "api_key_id");
    params.append("group_by", "model");
    params.append("group_by", "batch");
    params.append("group_by", "service_tier");
    if (page) params.set("page", page);

    const data = await openAIFetch<OpenAIUsageResult>("/organization/usage/completions", apiKey, params);
    buckets.push(...(data.data ?? []));

    page = data.next_page ?? null;
    if (!page) break;
  }

  return buckets;
}

export async function syncWorkspaceOpenAI(workspaceId: string, days = 30): Promise<void> {
  const connection = await prisma.openAIConnection.findUnique({ where: { workspaceId } });
  if (!connection) return;

  let apiKey = "";
  try {
    apiKey = decryptSecret(connection.adminKeyEnc);
  } catch (error) {
    await prisma.openAIConnection.update({
      where: { workspaceId },
      data: {
        status: ConnectionStatus.DEGRADED,
        lastError: "Failed to decrypt OpenAI key"
      }
    });
    internalErrorLog("openai.decrypt", error);
    return;
  }

  const now = new Date();
  const utcToday = startOfDayUtc(now);
  const start = new Date(utcToday.getTime() - days * 24 * 60 * 60 * 1000);
  const startTime = toUnixSeconds(start);
  const endTime = toUnixSeconds(new Date(utcToday.getTime() + 24 * 60 * 60 * 1000));

  try {
    const [costBuckets, usageBuckets] = await Promise.all([
      fetchAllCostBuckets(apiKey, startTime, endTime),
      fetchAllUsageBuckets(apiKey, startTime, endTime)
    ]);

    await prisma.$transaction(async (tx) => {
      for (const bucket of costBuckets) {
        const day = startOfDayUtc(new Date(bucket.start_time * 1000));

        for (const result of bucket.results ?? []) {
          const value = result.amount?.value ?? 0;
          const currency = (result.amount?.currency ?? "usd").toLowerCase();
          const projectId = result.project_id ?? "";
          const lineItem = result.line_item ?? "";

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
              value
            },
            update: {
              currency,
              value
            }
          });
        }
      }

      for (const bucket of usageBuckets) {
        const day = startOfDayUtc(new Date(bucket.start_time * 1000));

        for (const result of bucket.results ?? bucket.result ?? []) {
          const inputTokens = BigInt(result.input_tokens ?? 0);
          const outputTokens = BigInt(result.output_tokens ?? 0);
          const totalTokens = inputTokens + outputTokens;

          await tx.dailyUsageCompletions.upsert({
            where: {
              workspaceId_date_projectId_userId_apiKeyId_model_batch_serviceTier: {
                workspaceId,
                date: day,
                projectId: result.project_id ?? "",
                userId: result.user_id ?? "",
                apiKeyId: result.api_key_id ?? "",
                model: result.model ?? "",
                batch: String(result.batch ?? ""),
                serviceTier: result.service_tier ?? ""
              }
            },
            create: {
              workspaceId,
              date: day,
              projectId: result.project_id ?? "",
              userId: result.user_id ?? "",
              apiKeyId: result.api_key_id ?? "",
              model: result.model ?? "",
              batch: String(result.batch ?? ""),
              serviceTier: result.service_tier ?? "",
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

      await tx.openAIConnection.update({
        where: { workspaceId },
        data: {
          status: ConnectionStatus.OK,
          lastSyncAt: new Date(),
          lastError: null
        }
      });
    });
  } catch (error) {
    await prisma.openAIConnection.update({
      where: { workspaceId },
      data: {
        status: ConnectionStatus.DEGRADED,
        lastError: error instanceof Error ? error.message.slice(0, 400) : "OpenAI sync failed",
        lastSyncAt: new Date()
      }
    });
    internalErrorLog("openai.sync", error);
  }
}

export async function syncAllWorkspaces(days = 30): Promise<{ total: number }> {
  const connections = await prisma.openAIConnection.findMany({
    select: { workspaceId: true }
  });

  await Promise.all(connections.map((item) => syncWorkspaceOpenAI(item.workspaceId, days)));

  return { total: connections.length };
}
