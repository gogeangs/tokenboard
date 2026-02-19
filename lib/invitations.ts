import { randomBytes } from "crypto";
import { WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/db";

type Err = { error: string };

const INVITATION_EXPIRY_DAYS = 7;

export async function createInvitation(
  workspaceId: string,
  email: string,
  role: WorkspaceRole,
  createdBy: string
): Promise<Err | { invitation: Awaited<ReturnType<typeof prisma.workspaceInvitation.create>> }> {
  const existing = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      user: { email }
    }
  });
  if (existing) {
    return { error: "User is already a member of this workspace" };
  }

  const pending = await prisma.workspaceInvitation.findFirst({
    where: {
      workspaceId,
      email,
      acceptedAt: null,
      expiresAt: { gt: new Date() }
    }
  });
  if (pending) {
    return { error: "An active invitation already exists for this email" };
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId,
      email: email.toLowerCase(),
      role,
      token,
      expiresAt,
      createdBy
    }
  });

  return { invitation };
}

export async function acceptInvitation(token: string, userId: string): Promise<Err | { workspaceId: string }> {
  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { token }
  });

  if (!invitation) {
    return { error: "Invitation not found" };
  }

  if (invitation.acceptedAt) {
    return { error: "Invitation has already been accepted" };
  }

  if (invitation.expiresAt < new Date()) {
    return { error: "Invitation has expired" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  });
  if (!user) {
    return { error: "User not found" };
  }

  if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return { error: "This invitation was sent to a different email address" };
  }

  const existingMember = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId: invitation.workspaceId }
    }
  });
  if (existingMember) {
    return { error: "You are already a member of this workspace" };
  }

  await prisma.$transaction([
    prisma.workspaceMember.create({
      data: {
        userId,
        workspaceId: invitation.workspaceId,
        role: invitation.role
      }
    }),
    prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() }
    })
  ]);

  return { workspaceId: invitation.workspaceId };
}

export async function listPendingInvitations(workspaceId: string) {
  return prisma.workspaceInvitation.findMany({
    where: {
      workspaceId,
      acceptedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function revokeInvitation(id: string, workspaceId: string): Promise<Err | { success: true }> {
  const invitation = await prisma.workspaceInvitation.findFirst({
    where: { id, workspaceId, acceptedAt: null }
  });

  if (!invitation) {
    return { error: "Invitation not found or already accepted" };
  }

  await prisma.workspaceInvitation.delete({ where: { id } });
  return { success: true };
}
