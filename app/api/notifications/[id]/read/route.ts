import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const { id } = await params;
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== user.id) {
      return fail("Not found", 404);
    }

    await prisma.notification.update({
      where: { id },
      data: { read: true }
    });

    return ok({ success: true });
  } catch (error) {
    internalErrorLog("api.notifications.read", error);
    return fail("Internal error", 500);
  }
}
