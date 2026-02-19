import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MembersClient } from "@/app/components/MembersClient";
import type { WorkspaceOption } from "@/types/app";

export default async function MembersPage() {
  const user = await requireSessionUser();

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    include: {
      workspace: {
        select: { id: true, slug: true, displayName: true }
      }
    },
    orderBy: { workspace: { createdAt: "asc" } }
  });

  const workspaces: WorkspaceOption[] = memberships.map((m) => ({
    id: m.workspace.id,
    slug: m.workspace.slug,
    displayName: m.workspace.displayName,
    role: m.role
  }));

  return <MembersClient workspaces={workspaces} />;
}
