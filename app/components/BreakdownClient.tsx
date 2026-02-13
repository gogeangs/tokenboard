"use client";

import { useMemo, useState } from "react";
import type { WorkspaceOption } from "@/types/app";

type CostItem = { key: string; value: number };
type ModelItem = { key: string; totalTokens: string };

type Props = {
  workspaces: WorkspaceOption[];
};

export function BreakdownClient({ workspaces }: Props) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [by, setBy] = useState<"project" | "line_item" | "model">("project");
  const [items, setItems] = useState<Array<CostItem | ModelItem>>([]);
  const [metric, setMetric] = useState("cost");
  const [currency, setCurrency] = useState("usd");
  const [error, setError] = useState<string | null>(null);

  const month = useMemo(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }, []);

  async function loadBreakdown() {
    setError(null);
    const res = await fetch(`/api/breakdown?workspaceId=${workspaceId}&month=${month}&by=${by}`);
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Failed to load breakdown");
      return;
    }

    setItems(data.items ?? []);
    setMetric(data.metric);
    setCurrency(data.currency ?? "usd");
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-lg font-semibold">Breakdown</h1>
        <div className="flex gap-2">
          <select className="input" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.displayName}
              </option>
            ))}
          </select>
          <select className="input" value={by} onChange={(e) => setBy(e.target.value as typeof by)}>
            <option value="project">Project</option>
            <option value="line_item">Line item</option>
            <option value="model">Model</option>
          </select>
          <button className="btn" onClick={loadBreakdown}>
            Load
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="card">
        <p className="mb-3 text-sm text-slate-600">
          Month: {month}, Metric: {metric}
        </p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2">Key</th>
              <th className="py-2">Value</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.key} className="border-b border-slate-100">
                <td className="py-2">{item.key || "unscoped"}</td>
                <td className="py-2">
                  {"value" in item ? `${item.value.toFixed(4)} ${currency}` : `${item.totalTokens} tokens`}
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td className="py-4 text-slate-500" colSpan={2}>
                  No data loaded.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
