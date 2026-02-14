export type WorkspaceOption = {
  id: string;
  displayName: string;
  slug: string;
  role: string;
  openAIConfigured?: boolean;
  openAIMode?: "ORGANIZATION" | "PERSONAL" | null;
  openAIStatus?: "OK" | "DEGRADED" | "DISCONNECTED" | null;
  openAIUpdatedAt?: string | null;
  openAILastSyncAt?: string | null;
  anthropicConfigured?: boolean;
  anthropicStatus?: "OK" | "DEGRADED" | "DISCONNECTED" | null;
  anthropicUpdatedAt?: string | null;
  anthropicLastSyncAt?: string | null;
};
