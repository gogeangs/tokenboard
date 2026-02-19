import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { internalErrorLog } from "@/lib/errors";
import { acceptInvitation } from "@/lib/invitations";
import { fail, ok } from "@/lib/response";
import { acceptInvitationSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const parsed = acceptInvitationSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid request", 400);

    const result = await acceptInvitation(parsed.data.token, user.id);
    if ("error" in result) return fail(result.error, 400);

    return ok({ success: true, workspaceId: result.workspaceId });
  } catch (error) {
    internalErrorLog("api.invitations.accept", error);
    return fail("Internal error", 500);
  }
}
