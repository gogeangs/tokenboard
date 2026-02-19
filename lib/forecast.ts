import { prisma } from "@/lib/db";

type Point = { x: number; y: number };

export function linearRegression(points: Point[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export function movingAverage(values: number[], window: number): number[] {
  if (values.length === 0) return [];
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return result;
}

type ForecastResult = {
  predictedMonthEnd: number;
  dailyForecasts: Array<{ date: string; value: number }>;
  budgetExhaustionDate: string | null;
  currentSpend: number;
  daysElapsed: number;
  daysRemaining: number;
};

export async function computeForecast(workspaceId: string, month: string): Promise<ForecastResult> {
  const [year, mon] = month.split("-").map(Number);

  // Last day of the target month
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const today = new Date();
  const todayDate = today.getUTCDate();

  const daysElapsed = Math.min(todayDate, lastDay);
  const daysRemaining = Math.max(0, lastDay - daysElapsed);

  // Fetch last 60 days of DailyCost data
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);

  const dailyCosts = await prisma.dailyCost.findMany({
    where: {
      workspaceId,
      date: { gte: sixtyDaysAgo }
    },
    orderBy: { date: "asc" }
  });

  // Aggregate by date
  const costByDate = new Map<string, number>();
  for (const row of dailyCosts) {
    const dateKey = row.date.toISOString().slice(0, 10);
    costByDate.set(dateKey, (costByDate.get(dateKey) ?? 0) + Number(row.value));
  }

  // Build points for regression (x = day index, y = daily cost)
  const sortedDates = [...costByDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const points: Point[] = sortedDates.map(([, cost], i) => ({ x: i, y: cost }));

  // Current month spend
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
  let currentSpend = 0;
  for (const [date, cost] of costByDate) {
    if (date >= monthStart && date <= monthEnd) {
      currentSpend += cost;
    }
  }

  // Linear regression on historical data
  const { slope, intercept } = linearRegression(points);
  const nextIndex = points.length;

  // Generate daily forecasts for remaining days
  const dailyForecasts: Array<{ date: string; value: number }> = [];
  let forecastAccum = currentSpend;

  for (let d = 1; d <= daysRemaining; d++) {
    const futureDate = new Date(Date.UTC(year, mon - 1, daysElapsed + d));
    const dateStr = futureDate.toISOString().slice(0, 10);
    const predictedDaily = Math.max(0, intercept + slope * (nextIndex + d - 1));
    forecastAccum += predictedDaily;
    dailyForecasts.push({ date: dateStr, value: Math.round(forecastAccum * 100) / 100 });
  }

  const predictedMonthEnd = Math.round(forecastAccum * 100) / 100;

  // Budget exhaustion date
  let budgetExhaustionDate: string | null = null;
  const budget = await prisma.budget.findUnique({
    where: { workspaceId_month: { workspaceId, month } }
  });

  if (budget && slope > 0) {
    // Average daily cost from regression
    const avgDaily = points.length > 0
      ? intercept + slope * (nextIndex - 1)
      : 0;

    if (avgDaily > 0) {
      const budgetLeft = Number(budget.amount) - currentSpend;
      if (budgetLeft > 0) {
        const daysUntilExhaustion = Math.ceil(budgetLeft / avgDaily);
        const exhaustionDate = new Date(Date.UTC(year, mon - 1, daysElapsed + daysUntilExhaustion));
        budgetExhaustionDate = exhaustionDate.toISOString().slice(0, 10);
      } else {
        // Already exceeded
        budgetExhaustionDate = today.toISOString().slice(0, 10);
      }
    }
  }

  return {
    predictedMonthEnd,
    dailyForecasts,
    budgetExhaustionDate,
    currentSpend: Math.round(currentSpend * 100) / 100,
    daysElapsed,
    daysRemaining
  };
}
