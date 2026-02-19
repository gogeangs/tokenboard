import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";
import { trendQuerySchema } from "@/lib/validators";
import { getWorkspaceMembership } from "@/lib/workspace";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const search = req.nextUrl.searchParams;
    const parsed = trendQuerySchema.safeParse({
      workspaceId: search.get("workspaceId"),
      from: search.get("from"),
      to: search.get("to")
    });

    if (!parsed.success) {
      return fail("Invalid query", 400);
    }

    const { workspaceId, from, to } = parsed.data;
    const membership = await getWorkspaceMembership(user.id, workspaceId);
    if (!membership) return fail("Forbidden", 403);

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const costs = await prisma.dailyCost.findMany({
      where: {
        workspaceId,
        date: {
          gte: fromDate,
          lte: toDate
        }
      },
      select: {
        date: true,
        value: true,
        currency: true
      }
    });

    const byDate = new Map<string, number>();
    for (const row of costs) {
      const key = row.date.toISOString().slice(0, 10);
      byDate.set(key, (byDate.get(key) ?? 0) + Number(row.value));
    }

    const trend = Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, value]) => ({ date, value }));

    return ok({
      trend,
      currency: costs[0]?.currency ?? "usd"
    });
  } catch (error) {
    internalErrorLog("api.trend", error);
    return fail("Internal error", 500);
  }
}
