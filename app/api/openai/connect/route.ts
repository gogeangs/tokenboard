import { ConnectionStatus, OpenAIConnectionMode } from "@prisma/client";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";
import { connectOpenAISchema } from "@/lib/validators";
import { getWorkspaceAdmin } from "@/lib/workspace";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);
    const json = await req.json();
    const parsed = connectOpenAISchema.safeParse(json);
    if (!parsed.success) {
      return fail("Invalid request", 400);
    }

    const { workspaceId, apiKey, mode } = parsed.data;
    const admin = await getWorkspaceAdmin(user.id, workspaceId);
    if (!admin) {
      return fail("Forbidden", 403);
    }

    const adminKeyEnc = encryptSecret(apiKey);

    await prisma.openAIConnection.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        adminKeyEnc,
        mode: mode === "personal" ? OpenAIConnectionMode.PERSONAL : OpenAIConnectionMode.ORGANIZATION,
        status: ConnectionStatus.DISCONNECTED,
        lastSyncAt: null,
        lastError: null,
        creditTotalGranted: null,
        creditTotalUsed: null,
        creditTotalAvailable: null,
        creditCurrency: null
      },
      update: {
        adminKeyEnc,
        mode: mode === "personal" ? OpenAIConnectionMode.PERSONAL : OpenAIConnectionMode.ORGANIZATION,
        status: ConnectionStatus.DISCONNECTED,
        lastSyncAt: null,
        lastError: null,
        creditTotalGranted: null,
        creditTotalUsed: null,
        creditTotalAvailable: null,
        creditCurrency: null
      }
    });

    await prisma.dailyCost.deleteMany({
      where: {
        workspaceId,
        projectId: "__personal__",
        lineItem: "credit_estimate"
      }
    });

    return ok({ success: true, sync: "queued", mode });
  } catch (error) {
    internalErrorLog("openai.connect", error);
    return fail("Could not save OpenAI connection", 500);
  }
}
