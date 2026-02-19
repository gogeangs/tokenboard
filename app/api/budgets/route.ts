import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { internalErrorLog } from "@/lib/errors";
import { fail, ok } from "@/lib/response";
import { budgetSchema } from "@/lib/validators";
import { getWorkspaceOwner } from "@/lib/workspace";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Unauthorized", 401);

    const parsed = budgetSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail("Invalid request", 400);
    }

    const { workspaceId, month, amount, currency } = parsed.data;
    const owner = await getWorkspaceOwner(user.id, workspaceId);
    if (!owner) return fail("Forbidden", 403);

    const budget = await prisma.budget.upsert({
      where: {
        workspaceId_month: {
          workspaceId,
          month
        }
      },
      create: {
        workspaceId,
        month,
        currency: currency.toLowerCase(),
        amount
      },
      update: {
        currency: currency.toLowerCase(),
        amount
      }
    });

    return ok({ budget });
  } catch (error) {
    internalErrorLog("api.budgets", error);
    return fail("Internal error", 500);
  }
}
