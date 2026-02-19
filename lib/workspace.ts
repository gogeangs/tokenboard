import { WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getWorkspaceMembership(userId: string, workspaceId: string) {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId
      }
    }
  });

  return membership;
}

export async function getWorkspaceOwner(userId: string, workspaceId: string) {
  const membership = await getWorkspaceMembership(userId, workspaceId);
  if (!membership) {
    return null;
  }

  if (membership.role !== WorkspaceRole.OWNER) {
    return null;
  }

  return membership;
}

export function slugifyWorkspaceName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32) || "workspace";
}
