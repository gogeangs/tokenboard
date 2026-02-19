import { ConnectionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";
import { connectVertexSchema } from "@/lib/validators";
import { getWorkspaceAdmin } from "@/lib/workspace";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);
    const parsed = connectVertexSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Invalid request", 400);

    const { workspaceId, serviceAccountJson, projectId, region } = parsed.data;
    const admin = await getWorkspaceAdmin(user.id, workspaceId);
    if (!admin) return fail("Forbidden", 403);

    // Validate JSON format
    try {
      const sa = JSON.parse(serviceAccountJson);
      if (!sa.client_email || !sa.private_key) {
        return fail("Service account JSON must contain client_email and private_key", 400);
      }
    } catch {
      return fail("Invalid JSON format for service account", 400);
    }

    const serviceAccountEnc = encryptSecret(serviceAccountJson);

    await prisma.vertexAIConnection.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        serviceAccountEnc,
        projectId,
        region,
        status: ConnectionStatus.DISCONNECTED
      },
      update: {
        serviceAccountEnc,
        projectId,
        region,
        status: ConnectionStatus.DISCONNECTED,
        lastSyncAt: null,
        lastError: null
      }
    });

    return ok({ success: true, sync: "queued" });
  } catch (error) {
    internalErrorLog("vertex.connect", error);
    return fail("Could not save Vertex AI connection", 500);
  }
}
