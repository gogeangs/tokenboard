"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TrendChart } from "@/app/components/TrendChart";
import type { WorkspaceOption } from "@/types/app";

type SummaryResponse = {
  monthCost: number;
  todayCost: number;
  monthBudget: number | null;
  remaining: number | null;
  currency: string;
  connectionMode: "ORGANIZATION" | "PERSONAL";
  lastSyncAt: string | null;
  status: string;
  lastError: string | null;
  creditTotalGranted: number | null;
  creditTotalUsed: number | null;
  creditTotalAvailable: number | null;
  creditCurrency: string | null;
};

type TrendResponse = {
  trend: Array<{ date: string; value: number }>;
};

type Props = {
  workspaces: WorkspaceOption[];
};

function statusBadge(status?: string) {
  if (status === "OK") return "badge badge-ok";
  if (status === "DEGRADED") return "badge badge-warn";
  return "badge badge-muted";
}

function remediationForError(lastError: string): string {
  if (lastError.includes("api.usage.read") || lastError.includes("insufficient permissions")) {
    return "Use an Organization Admin key with usage/cost scopes in Settings.";
  }
  if (lastError.includes("Unauthorized")) {
    return "Verify CRON_SECRET and run Sync Now again.";
  }
  return "Update connection settings and retry sync.";
}

export function DashboardClient({ workspaces }: Props) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [trend, setTrend] = useState<Array<{ date: string; value: number }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const selectedWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
  const isOwner = selectedWorkspace?.role === "OWNER";

  const month = useMemo(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }, []);

  async function loadDashboard() {
    if (!workspaceId) return;
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - 13);
    const to = new Date();

    setError(null);
    setTrend(null);

    const [summaryRes, trendRes] = await Promise.all([
      fetch(`/api/summary?workspaceId=${workspaceId}&month=${month}`),
      fetch(`/api/trend?workspaceId=${workspaceId}&from=${from.toISOString()}&to=${to.toISOString()}`)
    ]);

    if (!summaryRes.ok || !trendRes.ok) {
      setError("Failed to load dashboard");
      return;
    }

    const summaryJson: SummaryResponse = await summaryRes.json();
    const trendJson: TrendResponse = await trendRes.json();
    setSummary(summaryJson);
    setTrend(trendJson.trend);
  }

  useEffect(() => {
    void loadDashboard();
  }, [workspaceId, month]);

  async function syncNow() {
    if (!workspaceId || !isOwner) return;
    setSyncing(true);
    setError(null);

    const res = await fetch("/api/openai/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId })
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Sync failed");
      setSyncing(false);
      return;
    }

    await loadDashboard();
    setSyncing(false);
  }

  if (!workspaces.length) {
    return <p>No workspace found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <span className={statusBadge(summary?.status)}>{summary?.status ?? "DISCONNECTED"}</span>
          <span className="badge badge-muted">{summary?.connectionMode ?? "-"}</span>
          <span className={selectedWorkspace?.openAIConfigured ? statusBadge(selectedWorkspace.openAIStatus ?? "DISCONNECTED") : "badge badge-muted"}>
            OpenAI {selectedWorkspace?.openAIConfigured ? selectedWorkspace.openAIStatus : "OFF"}
          </span>
          <span
            className={
              selectedWorkspace?.anthropicConfigured
                ? statusBadge(selectedWorkspace.anthropicStatus ?? "DISCONNECTED")
                : "badge badge-muted"
            }
          >
            Anthropic {selectedWorkspace?.anthropicConfigured ? selectedWorkspace.anthropicStatus : "OFF"}
          </span>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
          <select className="input md:w-72" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.displayName}
              </option>
            ))}
          </select>
          {isOwner ? (
            <button className="btn" type="button" onClick={syncNow} disabled={syncing}>
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="card border-red-200 bg-red-50 text-sm text-red-700">
          <p className="font-medium">Sync action failed</p>
          <p className="mt-1">{error}</p>
          <Link className="mt-2 inline-block underline" href="/settings">
            Go to settings
          </Link>
        </div>
      ) : null}

      {summary?.lastError ? (
        <div className="card border-amber-200 bg-amber-50 text-sm text-amber-800">
          <p className="font-medium">Latest sync issue</p>
          <p className="mt-1">{summary.lastError}</p>
          <p className="mt-1">{remediationForError(summary.lastError)}</p>
          <Link className="mt-2 inline-block underline" href="/settings">
            Open settings to update key
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <div className="card">
          <p className="text-sm text-slate-600">Last sync</p>
          <p className="text-lg font-semibold">{summary?.lastSyncAt ? new Date(summary.lastSyncAt).toLocaleTimeString() : "Never"}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">This month{summary?.connectionMode === "PERSONAL" ? " (est.)" : ""}</p>
          <p className="text-2xl font-semibold">{summary ? `${summary.monthCost.toFixed(2)} ${summary.currency}` : "-"}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Today{summary?.connectionMode === "PERSONAL" ? " (est.)" : ""}</p>
          <p className="text-2xl font-semibold">{summary ? `${summary.todayCost.toFixed(2)} ${summary.currency}` : "-"}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Budget left</p>
          <p className="text-2xl font-semibold">
            {summary?.remaining !== null && summary ? `${summary.remaining.toFixed(2)} ${summary.currency}` : "Not set"}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Personal credits</p>
          <p className="text-2xl font-semibold">
            {summary?.connectionMode === "PERSONAL" && summary.creditTotalAvailable !== null
              ? `${summary.creditTotalAvailable.toFixed(2)} ${(summary.creditCurrency ?? "usd").toLowerCase()}`
              : "-"}
          </p>
        </div>
      </div>

      <div className="card">
        <p className="mb-3 text-sm text-slate-600">Recent trend (14 days)</p>
        {!trend ? (
          <div className="space-y-2">
            <div className="skeleton h-8 w-full" />
            <div className="skeleton h-8 w-10/12" />
            <div className="skeleton h-8 w-9/12" />
          </div>
        ) : trend.length ? (
          <TrendChart data={trend} />
        ) : (
          <p className="text-sm text-slate-500">
            No synced data yet. Save an API key in settings, then run Sync Now.
          </p>
        )}
      </div>

      <div className="card text-sm text-slate-700">
        <p>Connection mode: {summary?.connectionMode ?? "-"}</p>
        {summary?.connectionMode === "PERSONAL" && summary.creditTotalGranted !== null ? (
          <p className="mt-1">
            Credits used/granted: {summary.creditTotalUsed?.toFixed(2)} / {summary.creditTotalGranted.toFixed(2)}{" "}
            {(summary.creditCurrency ?? "usd").toLowerCase()}
          </p>
        ) : null}
        {summary?.connectionMode === "PERSONAL" ? (
          <p className="mt-1 text-slate-500">Month/Today values are estimated from credit usage deltas.</p>
        ) : null}
      </div>
    </div>
  );
}
