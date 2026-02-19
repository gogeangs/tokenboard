"use client";

import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts";
import type { WorkspaceOption } from "@/types/app";

type KeyData = {
  apiKeyId: string;
  inputTokens: string;
  outputTokens: string;
  totalTokens: string;
};

type RatioData = {
  key: string;
  value: number;
  percent: string;
};

type ComparisonData = {
  current: { cost: number; tokens: number; period: string };
  previous: { cost: number; tokens: number; period: string };
  delta: { costPercent: string | null; tokensPercent: string | null };
};

type Props = {
  workspaces: WorkspaceOption[];
};

const COLORS = ["#0f172a", "#475569", "#94a3b8", "#cbd5e1", "#e2e8f0", "#f1f5f9"];
const TABS = ["By Key", "By Ratio", "Comparison"] as const;

export function AnalyticsClient({ workspaces }: Props) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [tab, setTab] = useState<(typeof TABS)[number]>("By Key");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Key analytics state
  const [keys, setKeys] = useState<KeyData[]>([]);

  // Ratio state
  const [ratios, setRatios] = useState<RatioData[]>([]);
  const [ratioGroupBy, setRatioGroupBy] = useState<"project" | "model">("project");

  // Comparison state
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [compPeriod, setCompPeriod] = useState<"week" | "month">("month");

  const month = useMemo(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }, []);

  async function loadKeyAnalytics() {
    const from = new Date();
    from.setUTCDate(1);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date();

    const res = await fetch(
      `/api/analytics/keys?workspaceId=${workspaceId}&from=${from.toISOString()}&to=${to.toISOString()}`
    );
    if (res.ok) {
      const data = await res.json();
      setKeys(data.keys);
    }
  }

  async function loadRatios() {
    const res = await fetch(
      `/api/analytics/ratios?workspaceId=${workspaceId}&month=${month}&groupBy=${ratioGroupBy}`
    );
    if (res.ok) {
      const data = await res.json();
      setRatios(data.ratios);
    }
  }

  async function loadComparison() {
    const res = await fetch(
      `/api/analytics/comparison?workspaceId=${workspaceId}&period=${compPeriod}&month=${month}`
    );
    if (res.ok) {
      const data = await res.json();
      setComparison(data);
    }
  }

  async function loadTab() {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === "By Key") await loadKeyAnalytics();
      else if (tab === "By Ratio") await loadRatios();
      else await loadComparison();
    } catch {
      setError("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTab();
  }, [workspaceId, tab, ratioGroupBy, compPeriod, month]);

  if (!workspaces.length) return <p>No workspace found.</p>;

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-lg font-semibold">Analytics</h1>
        <select
          aria-label="Workspace"
          className="input md:w-72"
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            className={tab === t ? "btn" : "btn-secondary"}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {error ? (
        <div className="card border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      ) : loading ? (
        <div className="card space-y-2">
          <div className="skeleton h-8 w-full" />
          <div className="skeleton h-8 w-10/12" />
        </div>
      ) : tab === "By Key" ? (
        <div className="card">
          <h2 className="mb-3 text-base font-semibold">Token Usage by API Key ({month})</h2>
          {keys.length === 0 ? (
            <p className="text-sm text-slate-500">No usage data for this period.</p>
          ) : (
            <>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={keys.slice(0, 10)} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <XAxis dataKey="apiKeyId" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="totalTokens" fill="#0f172a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="mt-4 w-full text-sm">
                <caption className="sr-only">API key usage</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="py-2">API Key</th>
                    <th className="py-2">Input</th>
                    <th className="py-2">Output</th>
                    <th className="py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.apiKeyId} className="border-b border-slate-100">
                      <td className="py-2 font-mono text-xs">{k.apiKeyId || "unknown"}</td>
                      <td className="py-2">{Number(k.inputTokens).toLocaleString()}</td>
                      <td className="py-2">{Number(k.outputTokens).toLocaleString()}</td>
                      <td className="py-2 font-semibold">{Number(k.totalTokens).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      ) : tab === "By Ratio" ? (
        <div className="card">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-base font-semibold">Cost / Token Ratio ({month})</h2>
            <select
              className="input w-32"
              value={ratioGroupBy}
              onChange={(e) => setRatioGroupBy(e.target.value as "project" | "model")}
            >
              <option value="project">By Project</option>
              <option value="model">By Model</option>
            </select>
          </div>
          {ratios.length === 0 ? (
            <p className="text-sm text-slate-500">No data for this period.</p>
          ) : (
            <div className="flex flex-col items-center gap-4 md:flex-row">
              <div className="h-64 w-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ratios} dataKey="value" nameKey="key" cx="50%" cy="50%" outerRadius={90} label>
                      {ratios.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <table className="flex-1 text-sm">
                <caption className="sr-only">Ratio breakdown</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="py-2">Name</th>
                    <th className="py-2">Value</th>
                    <th className="py-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  {ratios.map((r) => (
                    <tr key={r.key} className="border-b border-slate-100">
                      <td className="py-2">{r.key}</td>
                      <td className="py-2">{r.value.toLocaleString()}</td>
                      <td className="py-2">{r.percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-base font-semibold">Period Comparison</h2>
            <select
              className="input w-32"
              value={compPeriod}
              onChange={(e) => setCompPeriod(e.target.value as "week" | "month")}
            >
              <option value="month">Monthly</option>
              <option value="week">Weekly</option>
            </select>
          </div>
          {!comparison ? (
            <p className="text-sm text-slate-500">No data available.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Current ({comparison.current.period})</p>
                <p className="text-2xl font-semibold">${comparison.current.cost.toFixed(2)}</p>
                <p className="text-sm text-slate-600">{comparison.current.tokens.toLocaleString()} tokens</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Previous ({comparison.previous.period})</p>
                <p className="text-2xl font-semibold">${comparison.previous.cost.toFixed(2)}</p>
                <p className="text-sm text-slate-600">{comparison.previous.tokens.toLocaleString()} tokens</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4 md:col-span-2">
                <p className="text-sm text-slate-500">Change</p>
                <div className="mt-1 flex gap-6">
                  <div>
                    <span className="text-sm text-slate-600">Cost: </span>
                    <span
                      className={`font-semibold ${
                        comparison.delta.costPercent && Number(comparison.delta.costPercent) > 0
                          ? "text-red-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {comparison.delta.costPercent ? `${Number(comparison.delta.costPercent) > 0 ? "+" : ""}${comparison.delta.costPercent}%` : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-slate-600">Tokens: </span>
                    <span
                      className={`font-semibold ${
                        comparison.delta.tokensPercent && Number(comparison.delta.tokensPercent) > 0
                          ? "text-red-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {comparison.delta.tokensPercent ? `${Number(comparison.delta.tokensPercent) > 0 ? "+" : ""}${comparison.delta.tokensPercent}%` : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
