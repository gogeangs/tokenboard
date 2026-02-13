import { NextRequest } from "next/server";
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

  const result = await syncAllWorkspaces(30);
  return ok({ success: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
