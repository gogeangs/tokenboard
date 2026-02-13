import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/response";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return fail("Unauthorized", 401);

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    include: {
      workspace: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          connection: {
            select: {
              mode: true,
              status: true,
              lastSyncAt: true,
              lastError: true,
              updatedAt: true
            }
          }
        }
      }
    }
  });

  return ok({
    workspaces: memberships.map((m) => ({
      id: m.workspace.id,
      slug: m.workspace.slug,
      displayName: m.workspace.displayName,
      role: m.role,
      connection: m.workspace.connection
    }))
  });
}
