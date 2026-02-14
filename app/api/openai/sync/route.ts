import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { syncWorkspaceAnthropic } from "@/lib/anthropic-sync";
import { internalErrorLog } from "@/lib/errors";
import { syncWorkspaceOpenAI } from "@/lib/openai-sync";
import { fail, ok } from "@/lib/response";
import { syncWorkspaceSchema } from "@/lib/validators";
import { assertWorkspaceOwner } from "@/lib/workspace";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return fail("Unauthorized", 401);

  try {
    const parsed = syncWorkspaceSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail("Invalid request", 400);
    }

    const { workspaceId } = parsed.data;
    const owner = await assertWorkspaceOwner(user.id, workspaceId);
    if (!owner) return fail("Forbidden", 403);

    await Promise.all([syncWorkspaceOpenAI(workspaceId, 30), syncWorkspaceAnthropic(workspaceId, 30)]);
    return ok({ success: true });
  } catch (error) {
    internalErrorLog("openai.sync.manual", error);
    return fail("Manual sync failed", 500);
  }
}
