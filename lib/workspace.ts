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

export async function getWorkspaceAdmin(userId: string, workspaceId: string) {
  const membership = await getWorkspaceMembership(userId, workspaceId);
  if (!membership) {
    return null;
  }

  if (membership.role !== WorkspaceRole.OWNER && membership.role !== WorkspaceRole.ADMIN) {
    return null;
  }

  return membership;
}

export async function listWorkspaceMembers(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: { select: { id: true, email: true } }
    },
    orderBy: { user: { email: "asc" } }
  });
}

export async function removeMember(
  targetUserId: string,
  workspaceId: string,
  requesterId: string
): Promise<{ error: string } | { success: true }> {
  return prisma.$transaction(async (tx) => {
    if (targetUserId === requesterId) {
      const ownerCount = await tx.workspaceMember.count({
        where: { workspaceId, role: WorkspaceRole.OWNER }
      });
      if (ownerCount <= 1) {
        return { error: "Cannot remove the sole owner" };
      }
    }

    await tx.workspaceMember.delete({
      where: {
        userId_workspaceId: { userId: targetUserId, workspaceId }
      }
    });

    return { success: true as const };
  });
}

export async function changeMemberRole(
  targetUserId: string,
  workspaceId: string,
  newRole: WorkspaceRole,
  requesterId: string
): Promise<{ error: string } | { success: true }> {
  return prisma.$transaction(async (tx) => {
    const target = await tx.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } }
    });
    if (!target) return { error: "Member not found" };

    if (target.role === WorkspaceRole.OWNER && newRole !== WorkspaceRole.OWNER) {
      const ownerCount = await tx.workspaceMember.count({
        where: { workspaceId, role: WorkspaceRole.OWNER }
      });
      if (ownerCount <= 1 && targetUserId === requesterId) {
        return { error: "Cannot demote the sole owner" };
      }
    }

    await tx.workspaceMember.update({
      where: {
        userId_workspaceId: { userId: targetUserId, workspaceId }
      },
      data: { role: newRole }
    });

    return { success: true as const };
  });
}

export function slugifyWorkspaceName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32) || "workspace";
}
