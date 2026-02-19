"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { WorkspaceOption } from "@/types/app";

type Props = {
  workspaces: WorkspaceOption[];
};

export function SettingsClient({ workspaces }: Props) {
  const [workspaceState, setWorkspaceState] = useState(workspaces);
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [apiKey, setApiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [mode, setMode] = useState<"organization" | "personal">("organization");
  const [vertexJson, setVertexJson] = useState("");
  const [vertexProjectId, setVertexProjectId] = useState("");
  const [vertexRegion, setVertexRegion] = useState("us-central1");
  const [bedrockAccessKey, setBedrockAccessKey] = useState("");
  const [bedrockSecretKey, setBedrockSecretKey] = useState("");
  const [bedrockRegion, setBedrockRegion] = useState("us-east-1");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("usd");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [saving, setSaving] = useState(false);

  const month = useMemo(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }, []);

  const selectedWorkspace = workspaceState.find((workspace) => workspace.id === workspaceId);

  useEffect(() => {
    if (!selectedWorkspace?.openAIMode) return;
    setMode(selectedWorkspace.openAIMode === "PERSONAL" ? "personal" : "organization");
  }, [selectedWorkspace?.openAIMode]);

  async function connectOpenAI(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/openai/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, apiKey, mode })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessageType("error");
        setMessage(data.error ?? "OpenAI connect failed");
        return;
      }
      setApiKey("");
      setWorkspaceState((prev) =>
        prev.map((workspace) =>
          workspace.id === workspaceId
            ? {
                ...workspace,
                openAIConfigured: true,
                openAIMode: mode === "personal" ? "PERSONAL" : "ORGANIZATION",
                openAIStatus: "DISCONNECTED",
                openAIUpdatedAt: new Date().toISOString(),
                openAILastSyncAt: null
              }
            : workspace
        )
      );
      setMessageType("success");
      setMessage(`${mode === "personal" ? "Personal" : "Organization"} key saved. Sync pending.`);
    } catch {
      setMessageType("error");
      setMessage("OpenAI connect failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveBudget(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    const parsed = Number(amount);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setMessageType("error");
      setMessage("Budget amount must be positive");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, month, amount: parsed, currency })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessageType("error");
        setMessage(data.error ?? "Budget save failed");
        return;
      }
      setMessageType("success");
      setMessage("Budget saved.");
    } catch {
      setMessageType("error");
      setMessage("Budget save failed");
    } finally {
      setSaving(false);
    }
  }

  async function connectAnthropic(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/anthropic/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, apiKey: anthropicKey })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessageType("error");
        setMessage(data.error ?? "Anthropic connect failed");
        return;
      }
      setAnthropicKey("");
      setWorkspaceState((prev) =>
        prev.map((workspace) =>
          workspace.id === workspaceId
            ? {
                ...workspace,
                anthropicConfigured: true,
                anthropicStatus: "DISCONNECTED",
                anthropicUpdatedAt: new Date().toISOString(),
                anthropicLastSyncAt: null
              }
            : workspace
        )
      );
      setMessageType("success");
      setMessage("Anthropic key saved. Sync pending.");
    } catch {
      setMessageType("error");
      setMessage("Anthropic connect failed");
    } finally {
      setSaving(false);
    }
  }

  async function connectVertex(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/vertex/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          serviceAccountJson: vertexJson,
          projectId: vertexProjectId,
          region: vertexRegion
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessageType("error");
        setMessage(data.error ?? "Vertex AI connect failed");
        return;
      }
      setVertexJson("");
      setWorkspaceState((prev) =>
        prev.map((workspace) =>
          workspace.id === workspaceId
            ? {
                ...workspace,
                vertexConfigured: true,
                vertexStatus: "DISCONNECTED",
                vertexUpdatedAt: new Date().toISOString(),
                vertexLastSyncAt: null
              }
            : workspace
        )
      );
      setMessageType("success");
      setMessage("Vertex AI credentials saved. Sync pending.");
    } catch {
      setMessageType("error");
      setMessage("Vertex AI connect failed");
    } finally {
      setSaving(false);
    }
  }

  async function connectBedrock(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/bedrock/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          accessKeyId: bedrockAccessKey,
          secretAccessKey: bedrockSecretKey,
          region: bedrockRegion
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessageType("error");
        setMessage(data.error ?? "Bedrock connect failed");
        return;
      }
      setBedrockAccessKey("");
      setBedrockSecretKey("");
      setWorkspaceState((prev) =>
        prev.map((workspace) =>
          workspace.id === workspaceId
            ? {
                ...workspace,
                bedrockConfigured: true,
                bedrockStatus: "DISCONNECTED",
                bedrockUpdatedAt: new Date().toISOString(),
                bedrockLastSyncAt: null
              }
            : workspace
        )
      );
      setMessageType("success");
      setMessage("Bedrock credentials saved. Sync pending.");
    } catch {
      setMessageType("error");
      setMessage("Bedrock connect failed");
    } finally {
      setSaving(false);
    }
  }

  const statusText =
    selectedWorkspace?.openAIStatus === "OK"
      ? "Saved"
      : selectedWorkspace?.openAIStatus === "DEGRADED"
        ? "Saved (degraded)"
        : selectedWorkspace?.openAIConfigured
          ? "Sync pending"
          : "Not configured";

  const anthropicStatusText =
    selectedWorkspace?.anthropicStatus === "OK"
      ? "Saved"
      : selectedWorkspace?.anthropicStatus === "DEGRADED"
        ? "Saved (degraded)"
        : selectedWorkspace?.anthropicConfigured
          ? "Sync pending"
          : "Not configured";

  const vertexStatusText =
    selectedWorkspace?.vertexStatus === "OK"
      ? "Saved"
      : selectedWorkspace?.vertexStatus === "DEGRADED"
        ? "Saved (degraded)"
        : selectedWorkspace?.vertexConfigured
          ? "Sync pending"
          : "Not configured";

  const bedrockStatusText =
    selectedWorkspace?.bedrockStatus === "OK"
      ? "Saved"
      : selectedWorkspace?.bedrockStatus === "DEGRADED"
        ? "Saved (degraded)"
        : selectedWorkspace?.bedrockConfigured
          ? "Sync pending"
          : "Not configured";

  if (!workspaces.length) return <p>No workspace found.</p>;

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-lg font-semibold">Settings</h1>
        <select
          aria-label="Workspace"
          className="input max-w-xs"
          value={workspaceId}
          onChange={(e) => {
            setWorkspaceId(e.target.value);
            setMessage(null);
          }}
        >
          {workspaceState.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.displayName}
            </option>
          ))}
        </select>
      </div>

      {message && <p className={`text-sm ${messageType === "error" ? "text-red-600" : "text-green-700"}`}>{message}</p>}

      <form className="card space-y-3" onSubmit={connectOpenAI}>
        <h2 className="text-base font-semibold">OpenAI Connection</h2>
        <p className="text-sm text-slate-600">Status: {statusText}</p>
        <p className="text-sm text-slate-600">
          Last updated: {selectedWorkspace?.openAIUpdatedAt ? new Date(selectedWorkspace.openAIUpdatedAt).toLocaleString() : "Never"}
        </p>
        <p className="text-sm text-slate-600">
          Last sync: {selectedWorkspace?.openAILastSyncAt ? new Date(selectedWorkspace.openAILastSyncAt).toLocaleString() : "Never"}
        </p>

        <div className="grid gap-2 md:grid-cols-2">
          <button
            type="button"
            className={mode === "organization" ? "btn" : "btn-secondary"}
            onClick={() => setMode("organization")}
          >
            Organization Key
          </button>
          <button
            type="button"
            className={mode === "personal" ? "btn" : "btn-secondary"}
            onClick={() => setMode("personal")}
          >
            Personal Key
          </button>
        </div>

        <input
          aria-label="OpenAI API key"
          className="input"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={mode === "personal" ? "sk-..." : "sk-admin-..."}
          required
        />
        <button className="btn" type="submit" disabled={saving}>
          {mode === "personal" ? "Save Personal Key" : "Save Organization Key"}
        </button>
      </form>

      <form className="card space-y-3" onSubmit={connectAnthropic}>
        <h2 className="text-base font-semibold">Anthropic Connection</h2>
        <p className="text-sm text-slate-600">Status: {anthropicStatusText}</p>
        <p className="text-sm text-slate-600">
          Last updated:{" "}
          {selectedWorkspace?.anthropicUpdatedAt ? new Date(selectedWorkspace.anthropicUpdatedAt).toLocaleString() : "Never"}
        </p>
        <p className="text-sm text-slate-600">
          Last sync:{" "}
          {selectedWorkspace?.anthropicLastSyncAt ? new Date(selectedWorkspace.anthropicLastSyncAt).toLocaleString() : "Never"}
        </p>
        <input
          aria-label="Anthropic API key"
          className="input"
          type="password"
          value={anthropicKey}
          onChange={(e) => setAnthropicKey(e.target.value)}
          placeholder="sk-ant-api..."
          required
        />
        <button className="btn" type="submit" disabled={saving}>
          Save Anthropic Key
        </button>
      </form>

      <form className="card space-y-3" onSubmit={connectVertex}>
        <h2 className="text-base font-semibold">Google Vertex AI Connection</h2>
        <p className="text-sm text-slate-600">Status: {vertexStatusText}</p>
        <p className="text-sm text-slate-600">
          Last updated:{" "}
          {selectedWorkspace?.vertexUpdatedAt ? new Date(selectedWorkspace.vertexUpdatedAt).toLocaleString() : "Never"}
        </p>
        <p className="text-sm text-slate-600">
          Last sync:{" "}
          {selectedWorkspace?.vertexLastSyncAt ? new Date(selectedWorkspace.vertexLastSyncAt).toLocaleString() : "Never"}
        </p>
        <textarea
          aria-label="Service Account JSON"
          className="input min-h-[80px]"
          value={vertexJson}
          onChange={(e) => setVertexJson(e.target.value)}
          placeholder='{"type":"service_account","project_id":"...","private_key":"...",...}'
          required
        />
        <input
          aria-label="GCP Billing Account / Project ID"
          className="input"
          value={vertexProjectId}
          onChange={(e) => setVertexProjectId(e.target.value)}
          placeholder="billing-account-id or project-id"
          required
        />
        <select
          aria-label="Vertex AI region"
          className="input"
          value={vertexRegion}
          onChange={(e) => setVertexRegion(e.target.value)}
        >
          <option value="us-central1">us-central1</option>
          <option value="us-east4">us-east4</option>
          <option value="us-west1">us-west1</option>
          <option value="europe-west4">europe-west4</option>
          <option value="asia-northeast1">asia-northeast1</option>
        </select>
        <button className="btn" type="submit" disabled={saving}>
          Save Vertex AI Credentials
        </button>
      </form>

      <form className="card space-y-3" onSubmit={connectBedrock}>
        <h2 className="text-base font-semibold">AWS Bedrock Connection</h2>
        <p className="text-sm text-slate-600">Status: {bedrockStatusText}</p>
        <p className="text-sm text-slate-600">
          Last updated:{" "}
          {selectedWorkspace?.bedrockUpdatedAt ? new Date(selectedWorkspace.bedrockUpdatedAt).toLocaleString() : "Never"}
        </p>
        <p className="text-sm text-slate-600">
          Last sync:{" "}
          {selectedWorkspace?.bedrockLastSyncAt ? new Date(selectedWorkspace.bedrockLastSyncAt).toLocaleString() : "Never"}
        </p>
        <input
          aria-label="AWS Access Key ID"
          className="input"
          type="password"
          value={bedrockAccessKey}
          onChange={(e) => setBedrockAccessKey(e.target.value)}
          placeholder="AKIA..."
          required
        />
        <input
          aria-label="AWS Secret Access Key"
          className="input"
          type="password"
          value={bedrockSecretKey}
          onChange={(e) => setBedrockSecretKey(e.target.value)}
          placeholder="Secret access key"
          required
        />
        <select
          aria-label="AWS region"
          className="input"
          value={bedrockRegion}
          onChange={(e) => setBedrockRegion(e.target.value)}
        >
          <option value="us-east-1">us-east-1</option>
          <option value="us-west-2">us-west-2</option>
          <option value="eu-west-1">eu-west-1</option>
          <option value="ap-northeast-1">ap-northeast-1</option>
          <option value="ap-southeast-1">ap-southeast-1</option>
        </select>
        <button className="btn" type="submit" disabled={saving}>
          Save Bedrock Credentials
        </button>
      </form>

      <form className="card space-y-3" onSubmit={saveBudget}>
        <h2 className="text-base font-semibold">Monthly Budget</h2>
        <p className="text-sm text-slate-600">Month: {month}</p>
        <input
          aria-label="Budget amount"
          className="input"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100.00"
          required
        />
        <input
          aria-label="Budget currency"
          className="input"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          placeholder="usd"
          required
        />
        <button className="btn" type="submit" disabled={saving}>
          Save Budget
        </button>
      </form>
    </div>
  );
}
