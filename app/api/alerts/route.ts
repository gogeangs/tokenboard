import { AlertChannel, AlertType, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";
import { alertRuleSchema } from "@/lib/validators";
import { getWorkspaceAdmin, getWorkspaceMembership } from "@/lib/workspace";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const workspaceId = req.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) return fail("workspaceId required", 400);

    const membership = await getWorkspaceMembership(user.id, workspaceId);
    if (!membership) return fail("Forbidden", 403);

    const rules = await prisma.alertRule.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" }
    });

    return ok({ rules });
  } catch (error) {
    internalErrorLog("api.alerts.list", error);
    return fail("Internal error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const parsed = alertRuleSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid request", 400);

    const { workspaceId, type, channel, config, webhookUrl, enabled } = parsed.data;
    const admin = await getWorkspaceAdmin(user.id, workspaceId);
    if (!admin) return fail("Forbidden", 403);

    if (channel === "WEBHOOK" && !webhookUrl) {
      return fail("webhookUrl is required for WEBHOOK channel", 400);
    }

    const rule = await prisma.alertRule.create({
      data: {
        workspaceId,
        type: type as AlertType,
        channel: channel as AlertChannel,
        config: config as Prisma.InputJsonValue,
        webhookUrl: webhookUrl ?? null,
        enabled,
        createdBy: user.id
      }
    });

    return ok({ rule }, 201);
  } catch (error) {
    internalErrorLog("api.alerts.create", error);
    return fail("Internal error", 500);
  }
}
