import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BreakdownClient } from "@/app/components/BreakdownClient";

export default async function BreakdownPage() {
  const user = await requireSessionUser();

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    include: {
      workspace: {
        select: {
          id: true,
          slug: true,
          displayName: true
        }
      }
    }
  });

  const workspaces = memberships.map((m) => ({
    id: m.workspace.id,
    slug: m.workspace.slug,
    displayName: m.workspace.displayName,
    role: m.role
  }));

  return <BreakdownClient workspaces={workspaces} />;
}
