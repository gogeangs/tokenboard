import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getComparisonReport } from "@/lib/analytics";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";
import { analyticsComparisonQuerySchema } from "@/lib/validators";
import { getWorkspaceMembership } from "@/lib/workspace";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = analyticsComparisonQuerySchema.safeParse(params);
    if (!parsed.success) return fail("Invalid request", 400);

    const { workspaceId, period, month } = parsed.data;
    const membership = await getWorkspaceMembership(user.id, workspaceId);
    if (!membership) return fail("Forbidden", 403);

    const comparison = await getComparisonReport(workspaceId, period, month);
    return ok(comparison);
  } catch (error) {
    internalErrorLog("api.analytics.comparison", error);
    return fail("Internal error", 500);
  }
}
