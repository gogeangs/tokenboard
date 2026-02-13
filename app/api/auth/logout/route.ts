import { clearAuthCookie } from "@/lib/auth";
import { fail, ok } from "@/lib/response";

export async function POST() {
  try {
    await clearAuthCookie();
    return ok({ success: true });
  } catch {
    return fail("Logout failed", 500);
  }
}
