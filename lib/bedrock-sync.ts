import { ConnectionStatus } from "@prisma/client";
import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { internalErrorLog } from "@/lib/errors";
import { startOfDayUtc } from "@/lib/date";
import { evaluateBudgetAlerts, evaluateCostSpikeAlerts, evaluateConnectionAlerts } from "@/lib/alerts";

const SYNC_BATCH_SIZE = 5;

function createCostExplorerClient(accessKeyId: string, secretAccessKey: string, region: string) {
  return new CostExplorerClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}

async function fetchBedrockCosts(
  client: CostExplorerClient,
  startDate: string,
  endDate: string
) {
  const results: Array<{
    date: string;
    service: string;
    model: string;
    amount: number;
    currency: string;
  }> = [];

  let nextPageToken: string | undefined;

  do {
    const command = new GetCostAndUsageCommand({
      TimePeriod: { Start: startDate, End: endDate },
      Granularity: "DAILY",
      Metrics: ["UnblendedCost"],
      Filter: {
        Dimensions: {
          Key: "SERVICE",
          Values: ["Amazon Bedrock", "Amazon SageMaker"]
        }
      },
      GroupBy: [
        { Type: "DIMENSION", Key: "SERVICE" },
        { Type: "DIMENSION", Key: "USAGE_TYPE" }
      ],
      NextPageToken: nextPageToken
    });

    const response = await client.send(command);

    for (const result of response.ResultsByTime ?? []) {
      const date = result.TimePeriod?.Start ?? startDate;

      for (const group of result.Groups ?? []) {
        const service = group.Keys?.[0] ?? "Amazon Bedrock";
        const usageType = group.Keys?.[1] ?? "unknown";
        const amount = parseFloat(group.Metrics?.UnblendedCost?.Amount ?? "0");
        const currency = (group.Metrics?.UnblendedCost?.Unit ?? "USD").toLowerCase();

        if (amount > 0) {
          results.push({ date, service, model: usageType, amount, currency });
        }
      }
    }

    nextPageToken = response.NextPageToken;
  } while (nextPageToken);

  return results;
}

export async function syncWorkspaceBedrock(workspaceId: string, days = 30): Promise<void> {
  const connection = await prisma.bedrockConnection.findUnique({ where: { workspaceId } });
  if (!connection) return;

  const previousStatus = connection.status;

  let accessKeyId = "";
  let secretAccessKey = "";
  try {
    accessKeyId = decryptSecret(connection.accessKeyEnc);
    secretAccessKey = decryptSecret(connection.secretKeyEnc);
  } catch (error) {
    await prisma.bedrockConnection.update({
      where: { workspaceId },
      data: {
        status: ConnectionStatus.DEGRADED,
        lastError: "Failed to decrypt Bedrock credentials"
      }
    });
    internalErrorLog("bedrock.decrypt", error);
    return;
  }

  try {
    const client = createCostExplorerClient(accessKeyId, secretAccessKey, connection.region);
    const now = new Date();
    const utcToday = startOfDayUtc(now);
    const start = new Date(utcToday.getTime() - days * 24 * 60 * 60 * 1000);

    const startDate = start.toISOString().slice(0, 10);
    const endDate = utcToday.toISOString().slice(0, 10);

    const costRows = await fetchBedrockCosts(client, startDate, endDate);

    await prisma.$transaction(async (tx) => {
      for (const row of costRows) {
        const day = startOfDayUtc(new Date(row.date));
        const projectId = `bedrock:${connection.region}`;
        const lineItem = `bedrock:${row.model}`;

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
            currency: row.currency,
            value: row.amount
          },
          update: {
            currency: row.currency,
            value: row.amount
          }
        });
      }

      await tx.bedrockConnection.update({
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
        ? [evaluateConnectionAlerts(workspaceId, "bedrock", previousStatus, ConnectionStatus.OK)]
        : [])
    ]).catch((err) => internalErrorLog("bedrock.alerts", err));
  } catch (error) {
    const newStatus = ConnectionStatus.DEGRADED;
    await prisma.bedrockConnection.update({
      where: { workspaceId },
      data: {
        status: newStatus,
        lastError: error instanceof Error ? error.message.slice(0, 400) : "Bedrock sync failed",
        lastSyncAt: new Date()
      }
    });
    internalErrorLog("bedrock.sync", error);

    if (previousStatus !== newStatus) {
      evaluateConnectionAlerts(workspaceId, "bedrock", previousStatus, newStatus).catch((err) =>
        internalErrorLog("bedrock.alerts", err)
      );
    }
  }
}

export async function syncAllBedrockWorkspaces(days = 30): Promise<{ total: number }> {
  const connections = await prisma.bedrockConnection.findMany({
    select: { workspaceId: true }
  });

  for (let i = 0; i < connections.length; i += SYNC_BATCH_SIZE) {
    const batch = connections.slice(i, i + SYNC_BATCH_SIZE);
    await Promise.all(batch.map((c) => syncWorkspaceBedrock(c.workspaceId, days)));
  }

  return { total: connections.length };
}
