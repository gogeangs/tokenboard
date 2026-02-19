import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getCostRatios } from "@/lib/analytics";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";
import { analyticsRatioQuerySchema } from "@/lib/validators";
import { getWorkspaceMembership } from "@/lib/workspace";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = analyticsRatioQuerySchema.safeParse(params);
    if (!parsed.success) return fail("Invalid request", 400);

    const { workspaceId, month, groupBy } = parsed.data;
    const membership = await getWorkspaceMembership(user.id, workspaceId);
    if (!membership) return fail("Forbidden", 403);

    const ratios = await getCostRatios(workspaceId, month, groupBy);
    return ok({ ratios, groupBy });
  } catch (error) {
    internalErrorLog("api.analytics.ratios", error);
    return fail("Internal error", 500);
  }
}
