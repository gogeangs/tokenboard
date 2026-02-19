import { prisma } from "@/lib/db";
import { monthRange } from "@/lib/date";

export async function getPerKeyAnalytics(
  workspaceId: string,
  from: Date,
  to: Date
) {
  const usage = await prisma.dailyUsageCompletions.groupBy({
    by: ["apiKeyId"],
    where: {
      workspaceId,
      date: { gte: from, lte: to }
    },
    _sum: {
      inputTokens: true,
      outputTokens: true,
      totalTokens: true
    },
    orderBy: { _sum: { totalTokens: "desc" } }
  });

  return usage.map((row) => ({
    apiKeyId: row.apiKeyId || "unknown",
    inputTokens: (row._sum.inputTokens ?? BigInt(0)).toString(),
    outputTokens: (row._sum.outputTokens ?? BigInt(0)).toString(),
    totalTokens: (row._sum.totalTokens ?? BigInt(0)).toString()
  }));
}

export async function getCostRatios(
  workspaceId: string,
  month: string,
  groupBy: "project" | "model"
) {
  const { start, endExclusive } = monthRange(month);

  if (groupBy === "model") {
    const usage = await prisma.dailyUsageCompletions.groupBy({
      by: ["model"],
      where: {
        workspaceId,
        date: { gte: start, lt: endExclusive }
      },
      _sum: { totalTokens: true },
      orderBy: { _sum: { totalTokens: "desc" } }
    });

    const total = usage.reduce((sum, r) => sum + Number(r._sum.totalTokens ?? 0), 0);

    return usage.map((row) => ({
      key: row.model || "unknown",
      value: Number(row._sum.totalTokens ?? 0),
      percent: total > 0 ? ((Number(row._sum.totalTokens ?? 0) / total) * 100).toFixed(1) : "0"
    }));
  }

  const costs = await prisma.dailyCost.groupBy({
    by: ["projectId"],
    where: {
      workspaceId,
      date: { gte: start, lt: endExclusive }
    },
    _sum: { value: true },
    orderBy: { _sum: { value: "desc" } }
  });

  const total = costs.reduce((sum, r) => sum + Number(r._sum.value ?? 0), 0);

  return costs.map((row) => ({
    key: row.projectId || "unscoped",
    value: Number(row._sum.value ?? 0),
    percent: total > 0 ? ((Number(row._sum.value ?? 0) / total) * 100).toFixed(1) : "0"
  }));
}

export async function getComparisonReport(
  workspaceId: string,
  period: "week" | "month",
  month: string
) {
  const { start: currentStart, endExclusive: currentEnd } = monthRange(month);

  let previousStart: Date;
  let previousEnd: Date;

  if (period === "month") {
    const [year, mo] = month.split("-").map(Number);
    const prevMonth = mo === 1 ? 12 : mo - 1;
    const prevYear = mo === 1 ? year - 1 : year;
    previousStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
    previousEnd = new Date(Date.UTC(prevYear, prevMonth, 1));
  } else {
    previousStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    previousEnd = currentStart;
  }

  const [currentCost, previousCost, currentTokens, previousTokens] = await Promise.all([
    prisma.dailyCost.aggregate({
      where: { workspaceId, date: { gte: currentStart, lt: currentEnd } },
      _sum: { value: true }
    }),
    prisma.dailyCost.aggregate({
      where: { workspaceId, date: { gte: previousStart, lt: previousEnd } },
      _sum: { value: true }
    }),
    prisma.dailyUsageCompletions.aggregate({
      where: { workspaceId, date: { gte: currentStart, lt: currentEnd } },
      _sum: { totalTokens: true }
    }),
    prisma.dailyUsageCompletions.aggregate({
      where: { workspaceId, date: { gte: previousStart, lt: previousEnd } },
      _sum: { totalTokens: true }
    })
  ]);

  const curCost = Number(currentCost._sum.value ?? 0);
  const prevCost = Number(previousCost._sum.value ?? 0);
  const curTokens = Number(currentTokens._sum.totalTokens ?? 0);
  const prevTokens = Number(previousTokens._sum.totalTokens ?? 0);

  return {
    current: {
      cost: curCost,
      tokens: curTokens,
      period: period === "month" ? month : `${currentStart.toISOString().slice(0, 10)} to ${currentEnd.toISOString().slice(0, 10)}`
    },
    previous: {
      cost: prevCost,
      tokens: prevTokens,
      period: period === "month" ? `${previousStart.toISOString().slice(0, 7)}` : `${previousStart.toISOString().slice(0, 10)} to ${previousEnd.toISOString().slice(0, 10)}`
    },
    delta: {
      costPercent: prevCost > 0 ? (((curCost - prevCost) / prevCost) * 100).toFixed(1) : null,
      tokensPercent: prevTokens > 0 ? (((curTokens - prevTokens) / prevTokens) * 100).toFixed(1) : null
    }
  };
}
