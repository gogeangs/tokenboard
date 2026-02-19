import { ConnectionStatus } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { internalErrorLog } from "@/lib/errors";
import { startOfDayUtc } from "@/lib/date";
import { getGoogleAccessToken } from "@/lib/vertex-auth";
import { evaluateBudgetAlerts, evaluateCostSpikeAlerts, evaluateConnectionAlerts } from "@/lib/alerts";

type BillingRow = {
  service?: { description?: string };
  cost?: { amount?: number; currencyCode?: string };
  project?: { id?: string };
  usageStartTime?: string;
  usageEndTime?: string;
  sku?: { description?: string };
};

type BillingResponse = {
  rows?: BillingRow[];
  nextPageToken?: string;
};

const BILLING_BASE = "https://cloudbilling.googleapis.com/v1beta";
const MAX_PAGES = 50;
const SYNC_BATCH_SIZE = 5;

async function gcpFetch<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GCP request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  return (await res.json()) as T;
}

async function fetchVertexCosts(
  accessToken: string,
  billingAccountId: string,
  startDate: string,
  endDate: string
) {
  const rows: BillingRow[] = [];
  let pageToken: string | null = null;
  let pageCount = 0;

  while (true) {
    const params = new URLSearchParams({
      "dateRange.startDate": startDate,
      "dateRange.endDate": endDate,
      "filter": 'service.description:"Vertex AI" OR service.description:"Cloud AI"'
    });
    if (pageToken) params.set("pageToken", pageToken);

    const url = `${BILLING_BASE}/billingAccounts/${billingAccountId}/costs:list?${params.toString()}`;
    const data = await gcpFetch<BillingResponse>(url, accessToken);
    rows.push(...(data.rows ?? []));

    pageToken = data.nextPageToken ?? null;
    pageCount++;
    if (!pageToken || pageCount >= MAX_PAGES) break;
  }

  return rows;
}

export async function syncWorkspaceVertex(workspaceId: string, days = 30): Promise<void> {
  const connection = await prisma.vertexAIConnection.findUnique({ where: { workspaceId } });
  if (!connection) return;

  const previousStatus = connection.status;

  let serviceAccountJson = "";
  try {
    serviceAccountJson = decryptSecret(connection.serviceAccountEnc);
  } catch (error) {
    await prisma.vertexAIConnection.update({
      where: { workspaceId },
      data: {
        status: ConnectionStatus.DEGRADED,
        lastError: "Failed to decrypt Vertex AI credentials"
      }
    });
    internalErrorLog("vertex.decrypt", error);
    return;
  }

  try {
    const accessToken = await getGoogleAccessToken(serviceAccountJson);
    const sa = JSON.parse(serviceAccountJson) as { project_id?: string };
    const billingAccountId = connection.projectId;

    const now = new Date();
    const utcToday = startOfDayUtc(now);
    const start = new Date(utcToday.getTime() - days * 24 * 60 * 60 * 1000);

    const startDate = start.toISOString().slice(0, 10);
    const endDate = utcToday.toISOString().slice(0, 10);

    const rows = await fetchVertexCosts(accessToken, billingAccountId, startDate, endDate);

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const dateStr = row.usageStartTime ?? row.usageEndTime;
        if (!dateStr) continue;

        const day = startOfDayUtc(new Date(dateStr));
        const projectId = `vertex:${sa.project_id ?? row.project?.id ?? ""}`;
        const lineItem = `vertex:${row.sku?.description ?? row.service?.description ?? "usage"}`;
        const currency = (row.cost?.currencyCode ?? "usd").toLowerCase();
        const value = row.cost?.amount ?? 0;

        await tx.dailyCost.upsert({
          where: {
            workspaceId_date_projectId_lineItem: {
              workspaceId,
              date: day,
              projectId,
              lineItem
            }
          },
          create: { workspaceId, date: day, projectId, lineItem, currency, value },
          update: { currency, value }
        });
      }

      await tx.vertexAIConnection.update({
        where: { workspaceId },
        data: {
          status: ConnectionStatus.OK,
          lastSyncAt: new Date(),
          lastError: null
        }
      });
    });

    // Fire alerts after successful sync
    Promise.all([
      evaluateBudgetAlerts(workspaceId),
      evaluateCostSpikeAlerts(workspaceId),
      ...(previousStatus !== ConnectionStatus.OK
        ? [evaluateConnectionAlerts(workspaceId, "vertex", previousStatus, ConnectionStatus.OK)]
        : [])
    ]).catch((err) => internalErrorLog("vertex.alerts", err));
  } catch (error) {
    const newStatus = ConnectionStatus.DEGRADED;
    await prisma.vertexAIConnection.update({
      where: { workspaceId },
      data: {
        status: newStatus,
        lastError: error instanceof Error ? error.message.slice(0, 400) : "Vertex AI sync failed",
        lastSyncAt: new Date()
      }
    });
    internalErrorLog("vertex.sync", error);

    if (previousStatus !== newStatus) {
      evaluateConnectionAlerts(workspaceId, "vertex", previousStatus, newStatus).catch((err) =>
        internalErrorLog("vertex.alerts", err)
      );
    }
  }
}

export async function syncAllVertexWorkspaces(days = 30): Promise<{ total: number }> {
  const connections = await prisma.vertexAIConnection.findMany({
    select: { workspaceId: true }
  });

  for (let i = 0; i < connections.length; i += SYNC_BATCH_SIZE) {
    const batch = connections.slice(i, i + SYNC_BATCH_SIZE);
    await Promise.all(batch.map((c) => syncWorkspaceVertex(c.workspaceId, days)));
  }

  return { total: connections.length };
}
