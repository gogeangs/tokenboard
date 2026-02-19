import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { monthRange } from "@/lib/date";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";
import { breakdownQuerySchema } from "@/lib/validators";
import { getWorkspaceMembership } from "@/lib/workspace";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const search = req.nextUrl.searchParams;
    const parsed = breakdownQuerySchema.safeParse({
      workspaceId: search.get("workspaceId"),
      month: search.get("month"),
      by: search.get("by")
    });

    if (!parsed.success) {
      return fail("Invalid query", 400);
    }

    const { workspaceId, month, by } = parsed.data;
    const membership = await getWorkspaceMembership(user.id, workspaceId);
    if (!membership) return fail("Forbidden", 403);

    const { start, endExclusive } = monthRange(month);

    if (by === "model") {
      const rows = await prisma.dailyUsageCompletions.findMany({
        where: {
          workspaceId,
          date: {
            gte: start,
            lt: endExclusive
          }
        },
        select: {
          model: true,
          totalTokens: true
        }
      });

      const map = new Map<string, bigint>();
      for (const row of rows) {
        const key = row.model || "unscoped";
        map.set(key, (map.get(key) ?? 0n) + row.totalTokens);
      }

      const items = Array.from(map.entries())
        .sort((a, b) => {
          if (a[1] === b[1]) return 0;
          return a[1] > b[1] ? -1 : 1;
        })
        .map(([key, totalTokens]) => ({
          key,
          totalTokens: totalTokens.toString()
        }));

      return ok({
        by,
        metric: "total_tokens",
        items
      });
    }

    const rows = await prisma.dailyCost.findMany({
      where: {
        workspaceId,
        date: {
          gte: start,
          lt: endExclusive
        }
      },
      select: {
        projectId: true,
        lineItem: true,
        value: true,
        currency: true
      }
    });

    const map = new Map<string, number>();
    for (const row of rows) {
      const key = by === "project" ? row.projectId || "unscoped" : row.lineItem || "unscoped";
      map.set(key, (map.get(key) ?? 0) + Number(row.value));
    }

    const items = Array.from(map.entries())
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value);

    return ok({
      by,
      metric: "cost",
      currency: rows[0]?.currency ?? "usd",
      items
    });
  } catch (error) {
    internalErrorLog("api.breakdown", error);
    return fail("Internal error", 500);
  }
}
