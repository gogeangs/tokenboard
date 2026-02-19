import { WorkspaceRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { internalErrorLog } from "@/lib/errors";
import { createInvitation, listPendingInvitations } from "@/lib/invitations";
import { fail, ok } from "@/lib/response";
import { inviteMemberSchema } from "@/lib/validators";
import { getWorkspaceAdmin } from "@/lib/workspace";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const { workspaceId } = await params;
    const admin = await getWorkspaceAdmin(user.id, workspaceId);
    if (!admin) return fail("Forbidden", 403);

    const invitations = await listPendingInvitations(workspaceId);
    return ok({
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString()
      }))
    });
  } catch (error) {
    internalErrorLog("api.invitations.list", error);
    return fail("Internal error", 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const { workspaceId } = await params;
    const admin = await getWorkspaceAdmin(user.id, workspaceId);
    if (!admin) return fail("Forbidden", 403);

    const parsed = inviteMemberSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid request", 400);

    const result = await createInvitation(
      workspaceId,
      parsed.data.email,
      parsed.data.role as WorkspaceRole,
      user.id
    );
    if ("error" in result) return fail(result.error, 400);

    return ok({
      invitation: {
        id: result.invitation.id,
        email: result.invitation.email,
        role: result.invitation.role,
        token: result.invitation.token,
        expiresAt: result.invitation.expiresAt.toISOString()
      }
    }, 201);
  } catch (error) {
    internalErrorLog("api.invitations.create", error);
    return fail("Internal error", 500);
  }
}
