-- CreateTable
CREATE TABLE "AnthropicConnection" (
    "workspaceId" TEXT NOT NULL,
    "adminKeyEnc" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnthropicConnection_pkey" PRIMARY KEY ("workspaceId")
);

-- AddForeignKey
ALTER TABLE "AnthropicConnection" ADD CONSTRAINT "AnthropicConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
