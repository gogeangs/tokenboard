import { AlertChannel, AlertType, ConnectionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatMonth, monthRange, startOfDayUtc } from "@/lib/date";
import { internalErrorLog } from "@/lib/errors";
import { sendWebhook } from "@/lib/webhook";

type AlertConfig = {
  thresholdPercent?: number;
  spikeMultiplier?: number;
};

async function fireAlert(
  rule: { id: string; channel: AlertChannel; webhookUrl: string | null; workspaceId: string },
  title: string,
  body: string,
  type: AlertType
) {
  try {
    if (rule.channel === AlertChannel.WEBHOOK && rule.webhookUrl) {
      await sendWebhook(rule.webhookUrl, {
        alertRuleId: rule.id,
        workspaceId: rule.workspaceId,
        type,
        title,
        body,
        timestamp: new Date().toISOString()
      });
    }

    if (rule.channel === AlertChannel.IN_APP) {
      const members = await prisma.workspaceMember.findMany({
        where: { workspaceId: rule.workspaceId },
        select: { userId: true }
      });

      await prisma.notification.createMany({
        data: members.map((m) => ({
          userId: m.userId,
          workspaceId: rule.workspaceId,
          title,
          body,
          type
        }))
      });
    }
  } catch (error) {
    internalErrorLog("alerts.fire", error);
  }
}

export async function evaluateBudgetAlerts(workspaceId: string): Promise<void> {
  const now = new Date();
  const month = formatMonth(now);
  const { start, endExclusive } = monthRange(month);

  const [budget, costAgg] = await Promise.all([
    prisma.budget.findUnique({
      where: { workspaceId_month: { workspaceId, month } }
    }),
    prisma.dailyCost.aggregate({
      where: { workspaceId, date: { gte: start, lt: endExclusive } },
      _sum: { value: true }
    })
  ]);

  if (!budget) return;

  const totalCost = Number(costAgg._sum.value ?? 0);
  const budgetAmount = Number(budget.amount);
  if (budgetAmount <= 0) return;

  const usagePercent = (totalCost / budgetAmount) * 100;

  const rules = await prisma.alertRule.findMany({
    where: {
      workspaceId,
      type: AlertType.BUDGET_THRESHOLD,
      enabled: true
    }
  });

  for (const rule of rules) {
    const config = rule.config as AlertConfig;
    const threshold = config.thresholdPercent ?? 80;

    if (usagePercent >= threshold) {
      await fireAlert(
        rule,
        `Budget ${Math.round(usagePercent)}% used`,
        `Monthly spend $${totalCost.toFixed(2)} has reached ${Math.round(usagePercent)}% of your $${budgetAmount.toFixed(2)} budget.`,
        AlertType.BUDGET_THRESHOLD
      );
    }
  }
}

export async function evaluateCostSpikeAlerts(workspaceId: string): Promise<void> {
  const now = new Date();
  const today = startOfDayUtc(now);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recentCosts = await prisma.dailyCost.groupBy({
    by: ["date"],
    where: {
      workspaceId,
      date: { gte: sevenDaysAgo, lte: today }
    },
    _sum: { value: true }
  });

  if (recentCosts.length < 2) return;

  const sorted = recentCosts.sort((a, b) => a.date.getTime() - b.date.getTime());
  const todayCost = Number(sorted[sorted.length - 1]._sum.value ?? 0);
  const previousDays = sorted.slice(0, -1);
  const avgCost = previousDays.reduce((sum, d) => sum + Number(d._sum.value ?? 0), 0) / previousDays.length;

  if (avgCost <= 0) return;

  const rules = await prisma.alertRule.findMany({
    where: {
      workspaceId,
      type: AlertType.COST_SPIKE,
      enabled: true
    }
  });

  for (const rule of rules) {
    const config = rule.config as AlertConfig;
    const multiplier = config.spikeMultiplier ?? 2.0;

    if (todayCost >= avgCost * multiplier) {
      const spikeRatio = (todayCost / avgCost).toFixed(1);
      await fireAlert(
        rule,
        `Cost spike detected (${spikeRatio}x)`,
        `Today's cost $${todayCost.toFixed(2)} is ${spikeRatio}x the 7-day average of $${avgCost.toFixed(2)}.`,
        AlertType.COST_SPIKE
      );
    }
  }
}

export async function evaluateConnectionAlerts(
  workspaceId: string,
  provider: string,
  previousStatus: ConnectionStatus,
  newStatus: ConnectionStatus
): Promise<void> {
  if (previousStatus === newStatus) return;
  if (newStatus === ConnectionStatus.OK) return;

  const rules = await prisma.alertRule.findMany({
    where: {
      workspaceId,
      type: AlertType.CONNECTION_STATUS,
      enabled: true
    }
  });

  for (const rule of rules) {
    await fireAlert(
      rule,
      `${provider} connection ${newStatus}`,
      `${provider} connection status changed from ${previousStatus} to ${newStatus}.`,
      AlertType.CONNECTION_STATUS
    );
  }
}
