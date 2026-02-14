import { NextRequest } from "next/server";
import { syncAllAnthropicWorkspaces } from "@/lib/anthropic-sync";
import { getEnv } from "@/lib/env";
import { fail, ok } from "@/lib/response";
import { syncAllWorkspaces } from "@/lib/openai-sync";

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${getEnv().CRON_SECRET}`;
  return auth === expected;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return fail("Unauthorized", 401);
  }

  const [openAI, anthropic] = await Promise.all([syncAllWorkspaces(30), syncAllAnthropicWorkspaces(30)]);
  return ok({ success: true, openAI, anthropic });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
