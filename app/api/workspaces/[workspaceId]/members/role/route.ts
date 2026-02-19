import { WorkspaceRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";
import { changeMemberRoleSchema } from "@/lib/validators";
import { getWorkspaceOwner, changeMemberRole } from "@/lib/workspace";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const { workspaceId } = await params;
    const owner = await getWorkspaceOwner(user.id, workspaceId);
    if (!owner) return fail("Forbidden", 403);

    const parsed = changeMemberRoleSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid request", 400);

    const result = await changeMemberRole(
      parsed.data.userId,
      workspaceId,
      parsed.data.role as WorkspaceRole,
      user.id
    );
    if ("error" in result) return fail(result.error, 400);

    return ok({ success: true });
  } catch (error) {
    internalErrorLog("api.members.role", error);
    return fail("Internal error", 500);
  }
}
