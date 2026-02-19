import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";
import { forecastQuerySchema } from "@/lib/validators";
import { getWorkspaceMembership } from "@/lib/workspace";
import { computeForecast } from "@/lib/forecast";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = forecastQuerySchema.safeParse(params);
    if (!parsed.success) return fail("Invalid query", 400);

    const { workspaceId, month } = parsed.data;
    const member = await getWorkspaceMembership(user.id, workspaceId);
    if (!member) return fail("Forbidden", 403);

    const forecast = await computeForecast(workspaceId, month);
    return ok(forecast);
  } catch (error) {
    internalErrorLog("api.forecast", error);
    return fail("Internal error", 500);
  }
}
