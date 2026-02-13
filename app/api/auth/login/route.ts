import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { authSchema } from "@/lib/validators";
import { fail, ok } from "@/lib/response";
import { setAuthCookie, signSessionToken, verifyPassword } from "@/lib/auth";
import { internalErrorLog } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = authSchema.safeParse(json);

    if (!parsed.success) {
      return fail("Invalid request", 400);
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return fail("Invalid email or password", 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return fail("Invalid email or password", 401);
    }

    const token = await signSessionToken({ sub: user.id, email: user.email });
    await setAuthCookie(token);

    return ok({ id: user.id, email: user.email });
  } catch (error) {
    internalErrorLog("auth.login", error);
    return fail("Could not log in", 500);
  }
}
