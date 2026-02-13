import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { authSchema } from "@/lib/validators";
import { fail, ok } from "@/lib/response";
import { hashPassword, setAuthCookie, signSessionToken } from "@/lib/auth";
import { slugifyWorkspaceName } from "@/lib/workspace";
import { internalErrorLog } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = authSchema.safeParse(json);

    if (!parsed.success) {
      return fail("Invalid request", 400);
    }

    const { email, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return fail("Email is already registered", 409);
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash
        }
      });

      const workspace = await tx.workspace.create({
        data: {
          slug: `${slugifyWorkspaceName(email.split("@")[0])}-${createdUser.id.slice(0, 6)}`,
          displayName: "My Workspace"
        }
      });

      await tx.workspaceMember.create({
        data: {
          userId: createdUser.id,
          workspaceId: workspace.id,
          role: "OWNER"
        }
      });

      return createdUser;
    });

    const token = await signSessionToken({ sub: user.id, email: user.email });
    await setAuthCookie(token);

    return ok({ id: user.id, email: user.email }, 201);
  } catch (error) {
    internalErrorLog("auth.register", error);
    return fail("Could not complete registration", 500);
  }
}
