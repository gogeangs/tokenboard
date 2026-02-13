import { ConnectionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";
import { connectOpenAISchema } from "@/lib/validators";
import { assertWorkspaceOwner } from "@/lib/workspace";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return fail("Unauthorized", 401);

  try {
    const json = await req.json();
    const parsed = connectOpenAISchema.safeParse(json);
    if (!parsed.success) {
      return fail("Invalid request", 400);
    }

    const { workspaceId, adminKey } = parsed.data;
    const owner = await assertWorkspaceOwner(user.id, workspaceId);
    if (!owner) {
      return fail("Forbidden", 403);
    }

    const adminKeyEnc = encryptSecret(adminKey);

    await prisma.openAIConnection.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        adminKeyEnc,
        status: ConnectionStatus.DISCONNECTED,
        lastError: null
      },
      update: {
        adminKeyEnc,
        status: ConnectionStatus.DISCONNECTED,
        lastError: null
      }
    });

    return ok({ success: true, sync: "queued" });
  } catch (error) {
    internalErrorLog("openai.connect", error);
    return fail("Could not save OpenAI connection", 500);
  }
}
