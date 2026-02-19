import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";
import { updateAlertRuleSchema } from "@/lib/validators";
import { getWorkspaceAdmin } from "@/lib/workspace";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const { id } = await params;
    const rule = await prisma.alertRule.findUnique({ where: { id } });
    if (!rule) return fail("Not found", 404);

    const admin = await getWorkspaceAdmin(user.id, rule.workspaceId);
    if (!admin) return fail("Forbidden", 403);

    const parsed = updateAlertRuleSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid request", 400);

    const updateData: Prisma.AlertRuleUpdateInput = {};
    if (parsed.data.enabled !== undefined) updateData.enabled = parsed.data.enabled;
    if (parsed.data.channel !== undefined) updateData.channel = parsed.data.channel;
    if (parsed.data.webhookUrl !== undefined) updateData.webhookUrl = parsed.data.webhookUrl;
    if (parsed.data.config !== undefined) updateData.config = parsed.data.config as Prisma.InputJsonValue;

    const updated = await prisma.alertRule.update({
      where: { id },
      data: updateData
    });

    return ok({ rule: updated });
  } catch (error) {
    internalErrorLog("api.alerts.update", error);
    return fail("Internal error", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const { id } = await params;
    const rule = await prisma.alertRule.findUnique({ where: { id } });
    if (!rule) return fail("Not found", 404);

    const admin = await getWorkspaceAdmin(user.id, rule.workspaceId);
    if (!admin) return fail("Forbidden", 403);

    await prisma.alertRule.delete({ where: { id } });
    return ok({ success: true });
  } catch (error) {
    internalErrorLog("api.alerts.delete", error);
    return fail("Internal error", 500);
  }
}
