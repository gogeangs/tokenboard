import { getSessionUser } from "@/lib/auth";
import { fail, ok } from "@/lib/response";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return fail("Unauthorized", 401);

  return ok({ user });
}
