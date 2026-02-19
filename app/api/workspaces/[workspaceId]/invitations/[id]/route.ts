import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { internalErrorLog } from "@/lib/errors";
import { revokeInvitation } from "@/lib/invitations";
import { fail, ok } from "@/lib/response";
import { getWorkspaceAdmin } from "@/lib/workspace";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const { workspaceId, id } = await params;
    const admin = await getWorkspaceAdmin(user.id, workspaceId);
    if (!admin) return fail("Forbidden", 403);

    const result = await revokeInvitation(id, workspaceId);
    if ("error" in result) return fail(result.error, 400);

    return ok({ success: true });
  } catch (error) {
    internalErrorLog("api.invitations.revoke", error);
    return fail("Internal error", 500);
  }
}
