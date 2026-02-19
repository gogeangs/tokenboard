import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";
import { removeMemberSchema } from "@/lib/validators";
import {
  getWorkspaceMembership,
  getWorkspaceOwner,
  listWorkspaceMembers,
  removeMember
} from "@/lib/workspace";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const { workspaceId } = await params;
    const membership = await getWorkspaceMembership(user.id, workspaceId);
    if (!membership) return fail("Forbidden", 403);

    const members = await listWorkspaceMembers(workspaceId);
    return ok({
      members: members.map((m) => ({
        userId: m.userId,
        email: m.user.email,
        role: m.role
      }))
    });
  } catch (error) {
    internalErrorLog("api.members.list", error);
    return fail("Internal error", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const { workspaceId } = await params;
    const owner = await getWorkspaceOwner(user.id, workspaceId);
    if (!owner) return fail("Forbidden", 403);

    const parsed = removeMemberSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid request", 400);

    const result = await removeMember(parsed.data.userId, workspaceId, user.id);
    if ("error" in result) return fail(result.error, 400);

    return ok({ success: true });
  } catch (error) {
    internalErrorLog("api.members.remove", error);
    return fail("Internal error", 500);
  }
}
