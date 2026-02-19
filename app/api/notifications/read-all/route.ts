import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true }
    });

    return ok({ success: true });
  } catch (error) {
    internalErrorLog("api.notifications.readAll", error);
    return fail("Internal error", 500);
  }
}
