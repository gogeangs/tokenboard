import { timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { syncAllAnthropicWorkspaces } from "@/lib/anthropic-sync";
import { syncAllBedrockWorkspaces } from "@/lib/bedrock-sync";
import { getEnv } from "@/lib/env";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";
import { syncAllWorkspaces } from "@/lib/openai-sync";
import { syncAllVertexWorkspaces } from "@/lib/vertex-sync";

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${getEnv().CRON_SECRET}`;
  if (auth.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return fail("Unauthorized", 401);
  }

  try {
    const [openAI, anthropic, vertex, bedrock] = await Promise.all([
      syncAllWorkspaces(30),
      syncAllAnthropicWorkspaces(30),
      syncAllVertexWorkspaces(30),
      syncAllBedrockWorkspaces(30)
    ]);
    return ok({ success: true, openAI, anthropic, vertex, bedrock });
  } catch (error) {
    internalErrorLog("cron.sync", error);
    return fail("Sync failed", 500);
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
