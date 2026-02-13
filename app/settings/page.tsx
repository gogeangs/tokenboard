import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SettingsClient } from "@/app/components/SettingsClient";

export default async function SettingsPage() {
  const user = await requireSessionUser();

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    include: {
      workspace: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          connection: {
            select: {
              mode: true,
              status: true,
              updatedAt: true,
              lastSyncAt: true
            }
          }
        }
      }
    }
  });

  const workspaces = memberships.map((m) => ({
    id: m.workspace.id,
    slug: m.workspace.slug,
    displayName: m.workspace.displayName,
    role: m.role,
    openAIConfigured: Boolean(m.workspace.connection),
    openAIMode: m.workspace.connection?.mode ?? null,
    openAIStatus: m.workspace.connection?.status ?? null,
    openAIUpdatedAt: m.workspace.connection?.updatedAt?.toISOString() ?? null,
    openAILastSyncAt: m.workspace.connection?.lastSyncAt?.toISOString() ?? null
  }));

  return <SettingsClient workspaces={workspaces} />;
}
