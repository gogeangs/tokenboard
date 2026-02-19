import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getPerKeyAnalytics } from "@/lib/analytics";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";
import { analyticsKeysQuerySchema } from "@/lib/validators";
import { getWorkspaceMembership } from "@/lib/workspace";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = analyticsKeysQuerySchema.safeParse(params);
    if (!parsed.success) return fail("Invalid request", 400);

    const { workspaceId, from, to } = parsed.data;
    const membership = await getWorkspaceMembership(user.id, workspaceId);
    if (!membership) return fail("Forbidden", 403);

    const keys = await getPerKeyAnalytics(workspaceId, new Date(from), new Date(to));
    return ok({ keys });
  } catch (error) {
    internalErrorLog("api.analytics.keys", error);
    return fail("Internal error", 500);
  }
}
