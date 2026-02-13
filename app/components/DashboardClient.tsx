"use client";

import { useEffect, useMemo, useState } from "react";
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

export function DashboardClient({ workspaces }: Props) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [trend, setTrend] = useState<Array<{ date: string; value: number }>>([]);
  const [error, setError] = useState<string | null>(null);

  const month = useMemo(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    if (!workspaceId) return;

    const from = new Date();
    from.setUTCDate(from.getUTCDate() - 13);
    const to = new Date();

    async function load() {
      setError(null);

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

    void load();
  }, [workspaceId, month]);

  if (!workspaces.length) {
    return <p>No workspace found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <select className="input max-w-xs" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.displayName}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 md:grid-cols-5">
        <div className="card">
          <p className="text-sm text-slate-600">
            {summary?.connectionMode === "PERSONAL" ? "This month (est.)" : "This month"}
          </p>
          <p className="text-2xl font-semibold">{summary ? `${summary.monthCost.toFixed(2)} ${summary.currency}` : "-"}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">
            {summary?.connectionMode === "PERSONAL" ? "Today (est.)" : "Today"}
          </p>
          <p className="text-2xl font-semibold">{summary ? `${summary.todayCost.toFixed(2)} ${summary.currency}` : "-"}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Budget left</p>
          <p className="text-2xl font-semibold">
            {summary?.remaining !== null && summary ? `${summary.remaining.toFixed(2)} ${summary.currency}` : "Not set"}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Status</p>
          <p className="text-2xl font-semibold">{summary?.status ?? "-"}</p>
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
        <TrendChart data={trend} />
      </div>

      <div className="card text-sm text-slate-700">
        <p>Connection mode: {summary?.connectionMode ?? "-"}</p>
        <p>Last sync: {summary?.lastSyncAt ? new Date(summary.lastSyncAt).toLocaleString() : "Never"}</p>
        {summary?.connectionMode === "PERSONAL" && summary.creditTotalGranted !== null ? (
          <p className="mt-1">
            Credits used/granted: {summary.creditTotalUsed?.toFixed(2)} / {summary.creditTotalGranted.toFixed(2)}{" "}
            {(summary.creditCurrency ?? "usd").toLowerCase()}
          </p>
        ) : null}
        {summary?.connectionMode === "PERSONAL" ? (
          <p className="mt-1 text-slate-500">Month/Today values are estimated from credit usage deltas.</p>
        ) : null}
        {summary?.lastError ? <p className="mt-1 text-red-600">Last error: {summary.lastError}</p> : null}
      </div>
    </div>
  );
}
