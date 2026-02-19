import { ConnectionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";
import { connectBedrockSchema } from "@/lib/validators";
import { getWorkspaceAdmin } from "@/lib/workspace";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);
    const parsed = connectBedrockSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid request", 400);

    const { workspaceId, accessKeyId, secretAccessKey, region } = parsed.data;
    const admin = await getWorkspaceAdmin(user.id, workspaceId);
    if (!admin) return fail("Forbidden", 403);

    const accessKeyEnc = encryptSecret(accessKeyId);
    const secretKeyEnc = encryptSecret(secretAccessKey);

    await prisma.bedrockConnection.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        accessKeyEnc,
        secretKeyEnc,
        region,
        status: ConnectionStatus.DISCONNECTED
      },
      update: {
        accessKeyEnc,
        secretKeyEnc,
        region,
        status: ConnectionStatus.DISCONNECTED,
        lastSyncAt: null,
        lastError: null
      }
    });

    return ok({ success: true, sync: "queued" });
  } catch (error) {
    internalErrorLog("bedrock.connect", error);
    return fail("Could not save Bedrock connection", 500);
  }
}
