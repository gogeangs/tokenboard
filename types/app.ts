export type WorkspaceOption = {
  id: string;
  displayName: string;
  slug: string;
  role: string;
  openAIConfigured?: boolean;
  openAIMode?: "ORGANIZATION" | "PERSONAL" | null;
};
