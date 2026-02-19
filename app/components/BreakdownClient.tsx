"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WorkspaceOption } from "@/types/app";

type CostItem = { key: string; value: number };
type ModelItem = { key: string; totalTokens: string };

type Props = {
  workspaces: WorkspaceOption[];
};

export function BreakdownClient({ workspaces }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }, []);

  const byParam = searchParams.get("by");
  const validBy = ["project", "line_item", "model"] as const;
  const initialBy = validBy.includes(byParam as typeof validBy[number]) ? (byParam as typeof validBy[number]) : "project";

  const [workspaceId, setWorkspaceId] = useState(searchParams.get("workspaceId") ?? workspaces[0]?.id ?? "");
  const [by, setBy] = useState<"project" | "line_item" | "model">(initialBy);
  const [month, setMonth] = useState(searchParams.get("month") ?? currentMonth);
  const [items, setItems] = useState<Array<CostItem | ModelItem>>([]);
  const [metric, setMetric] = useState("cost");
  const [currency, setCurrency] = useState("usd");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function syncQuery(next: { workspaceId: string; by: string; month: string }) {
    const query = new URLSearchParams();
    query.set("workspaceId", next.workspaceId);
    query.set("by", next.by);
    query.set("month", next.month);
    router.replace(`${pathname}?${query.toString()}`);
  }

  async function loadBreakdown(next?: { workspaceId: string; by: "project" | "line_item" | "model"; month: string }) {
    const state = next ?? { workspaceId, by, month };
    setLoading(true);
    setError(null);
    syncQuery(state);

    try {
      const res = await fetch(`/api/breakdown?workspaceId=${state.workspaceId}&month=${state.month}&by=${state.by}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to load breakdown");
        return;
      }

      setItems(data.items ?? []);
      setMetric(data.metric);
      setCurrency(data.currency ?? "usd");
    } catch {
      setError("Failed to load breakdown");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!workspaceId) return;
    void loadBreakdown({ workspaceId, by, month });
  }, [workspaceId, by, month]);

  const topItems = items.slice(0, 5).map((item) => ({
    key: item.key,
    value: "value" in item ? item.value : Number(item.totalTokens)
  }));

  if (!workspaces.length) return <p>No workspace found.</p>;

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-lg font-semibold">Breakdown</h1>
        <div className="grid w-full gap-2 md:w-auto md:grid-cols-4">
          <select
            aria-label="Workspace"
            className="input"
            value={workspaceId}
            onChange={(e) => {
              const next = e.target.value;
              setWorkspaceId(next);
            }}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.displayName}
              </option>
            ))}
          </select>
          <select
            aria-label="Group by"
            className="input"
            value={by}
            onChange={(e) => {
              const next = e.target.value as typeof by;
              setBy(next);
            }}
          >
            <option value="project">Project</option>
            <option value="line_item">Line item</option>
            <option value="model">Model</option>
          </select>
          <input
            aria-label="Month"
            className="input"
            type="month"
            value={month}
            onChange={(e) => {
              const next = e.target.value;
              setMonth(next);
            }}
          />
          <button className="btn" onClick={() => void loadBreakdown()}>
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="card">
        <p className="mb-3 text-sm text-slate-600">
          Month: {month}, Metric: {metric}
        </p>

        {loading ? (
          <div className="space-y-2">
            <div className="skeleton h-8 w-full" />
            <div className="skeleton h-8 w-11/12" />
            <div className="skeleton h-8 w-9/12" />
          </div>
        ) : items.length ? (
          <>
            <div className="mb-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topItems} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <XAxis dataKey="key" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0f172a" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <table className="w-full text-left text-sm">
              <caption className="sr-only">Breakdown by {by}</caption>
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
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            No data yet. Save an OpenAI key in settings and run a sync to populate breakdown data.
          </p>
        )}
      </div>
    </div>
  );
}
