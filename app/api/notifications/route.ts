import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const rawLimit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10);
    const limit = Math.min(Math.max(1, Number.isNaN(rawLimit) ? 50 : rawLimit), 100);

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        workspace: { select: { displayName: true } }
      }
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, read: false }
    });

    return ok({
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        read: n.read,
        workspaceName: n.workspace.displayName,
        createdAt: n.createdAt.toISOString()
      })),
      unreadCount
    });
  } catch (error) {
    internalErrorLog("api.notifications.list", error);
    return fail("Internal error", 500);
  }
}
