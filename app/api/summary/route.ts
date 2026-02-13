import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMonth, monthRange, startOfDayUtc } from "@/lib/date";
import { fail, ok } from "@/lib/response";
import { summaryQuerySchema } from "@/lib/validators";
import { assertWorkspaceMembership } from "@/lib/workspace";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return fail("Unauthorized", 401);

  const search = req.nextUrl.searchParams;
  const parsed = summaryQuerySchema.safeParse({
    workspaceId: search.get("workspaceId"),
    month: search.get("month")
  });

  if (!parsed.success) {
    return fail("Invalid query", 400);
  }

  const { workspaceId, month } = parsed.data;
  const membership = await assertWorkspaceMembership(user.id, workspaceId);
  if (!membership) return fail("Forbidden", 403);

  const { start, endExclusive } = monthRange(month);
  const today = startOfDayUtc(new Date());

  const [monthCosts, todayCosts, budget, conn] = await Promise.all([
    prisma.dailyCost.findMany({
      where: {
        workspaceId,
        date: {
          gte: start,
          lt: endExclusive
        }
      },
      select: { value: true, currency: true }
    }),
    prisma.dailyCost.findMany({
      where: {
        workspaceId,
        date: today
      },
      select: { value: true }
    }),
    prisma.budget.findUnique({
      where: {
        workspaceId_month: {
          workspaceId,
          month
        }
      }
    }),
    prisma.openAIConnection.findUnique({
      where: { workspaceId },
      select: { lastSyncAt: true, status: true, lastError: true }
    })
  ]);

  const monthCost = monthCosts.reduce((sum, item) => sum + Number(item.value), 0);
  const todayCost = todayCosts.reduce((sum, item) => sum + Number(item.value), 0);
  const monthBudget = budget ? Number(budget.amount) : null;
  const remaining = monthBudget === null ? null : Math.max(0, monthBudget - monthCost);
  const currency = (budget?.currency ?? monthCosts[0]?.currency ?? "usd").toLowerCase();

  return ok({
    month: formatMonth(start),
    monthCost,
    todayCost,
    monthBudget,
    remaining,
    currency,
    lastSyncAt: conn?.lastSyncAt ?? null,
    status: conn?.status ?? "DISCONNECTED",
    lastError: conn?.lastError ?? null
  });
}
