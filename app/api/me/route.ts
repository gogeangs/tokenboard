import { getSessionUser } from "@/lib/auth";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);
    return ok({ user });
  } catch (error) {
    internalErrorLog("api.me", error);
    return fail("Internal error", 500);
  }
}
