"use client";

import { useEffect, useState } from "react";
import type { WorkspaceOption } from "@/types/app";

type AlertRule = {
  id: string;
  type: string;
  channel: string;
  enabled: boolean;
  config: Record<string, unknown>;
  webhookUrl: string | null;
  createdAt: string;
};

type Props = {
  workspaces: WorkspaceOption[];
};

const ALERT_TYPES = [
  { value: "BUDGET_THRESHOLD", label: "Budget Threshold" },
  { value: "COST_SPIKE", label: "Cost Spike" },
  { value: "CONNECTION_STATUS", label: "Connection Status" }
];

const CHANNELS = [
  { value: "IN_APP", label: "In-App" },
  { value: "WEBHOOK", label: "Webhook" }
];

export function AlertsClient({ workspaces }: Props) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);

  // Form state
  const [newType, setNewType] = useState("BUDGET_THRESHOLD");
  const [newChannel, setNewChannel] = useState("IN_APP");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newThreshold, setNewThreshold] = useState("80");
  const [newMultiplier, setNewMultiplier] = useState("2.0");

  const selectedWorkspace = workspaces.find((w) => w.id === workspaceId);
  const isAdmin = selectedWorkspace?.role === "OWNER" || selectedWorkspace?.role === "ADMIN";

  async function loadRules() {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/alerts?workspaceId=${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules);
      }
    } catch {
      setMessage("Failed to load alert rules");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRules();
  }, [workspaceId]);

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const config: Record<string, unknown> = {};
    if (newType === "BUDGET_THRESHOLD") config.thresholdPercent = Number(newThreshold);
    if (newType === "COST_SPIKE") config.spikeMultiplier = Number(newMultiplier);

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          type: newType,
          channel: newChannel,
          config,
          webhookUrl: newChannel === "WEBHOOK" ? newWebhookUrl : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Failed to create rule");
        setMessageType("error");
        return;
      }

      setMessage("Alert rule created");
      setMessageType("success");
      void loadRules();
    } catch {
      setMessage("Failed to create rule");
      setMessageType("error");
    }
  }

  async function toggleRule(id: string, enabled: boolean) {
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled })
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error ?? "Failed to update rule");
        setMessageType("error");
        return;
      }
      void loadRules();
    } catch {
      setMessage("Failed to update rule");
      setMessageType("error");
    }
  }

  async function deleteRule(id: string) {
    if (!confirm("Are you sure you want to delete this alert rule?")) return;
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error ?? "Failed to delete rule");
        setMessageType("error");
        return;
      }
      void loadRules();
    } catch {
      setMessage("Failed to delete rule");
      setMessageType("error");
    }
  }

  function formatConfig(rule: AlertRule): string {
    const config = rule.config;
    if (rule.type === "BUDGET_THRESHOLD") return `Threshold: ${config.thresholdPercent ?? 80}%`;
    if (rule.type === "COST_SPIKE") return `Multiplier: ${config.spikeMultiplier ?? 2.0}x`;
    return "Status change";
  }

  if (!workspaces.length) return <p>No workspace found.</p>;

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-lg font-semibold">Alert Rules</h1>
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

      {message ? (
        <div
          className={`card text-sm ${
            messageType === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      ) : null}

      {isAdmin ? (
        <form className="card space-y-3" onSubmit={createRule}>
          <h2 className="text-base font-semibold">New Alert Rule</h2>
          <div className="grid gap-2 md:grid-cols-2">
            <select className="input" value={newType} onChange={(e) => setNewType(e.target.value)}>
              {ALERT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select className="input" value={newChannel} onChange={(e) => setNewChannel(e.target.value)}>
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {newType === "BUDGET_THRESHOLD" ? (
            <div>
              <label className="text-sm text-slate-600">Threshold (%)</label>
              <input
                className="input"
                type="number"
                min="1"
                max="200"
                value={newThreshold}
                onChange={(e) => setNewThreshold(e.target.value)}
              />
            </div>
          ) : null}

          {newType === "COST_SPIKE" ? (
            <div>
              <label className="text-sm text-slate-600">Spike Multiplier (x)</label>
              <input
                className="input"
                type="number"
                step="0.1"
                min="1.1"
                value={newMultiplier}
                onChange={(e) => setNewMultiplier(e.target.value)}
              />
            </div>
          ) : null}

          {newChannel === "WEBHOOK" ? (
            <input
              className="input"
              type="url"
              placeholder="https://hooks.example.com/..."
              value={newWebhookUrl}
              onChange={(e) => setNewWebhookUrl(e.target.value)}
              required
            />
          ) : null}

          <button className="btn" type="submit">
            Create Rule
          </button>
        </form>
      ) : null}

      <div className="card">
        <h2 className="mb-3 text-base font-semibold">Active Rules</h2>
        {loading ? (
          <div className="space-y-2">
            <div className="skeleton h-8 w-full" />
            <div className="skeleton h-8 w-full" />
          </div>
        ) : rules.length === 0 ? (
          <p className="text-sm text-slate-500">No alert rules configured.</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Alert rules</caption>
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="py-2">Type</th>
                <th className="py-2">Channel</th>
                <th className="py-2">Config</th>
                <th className="py-2">Status</th>
                {isAdmin ? <th className="py-2">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-slate-100">
                  <td className="py-2">{rule.type.replace(/_/g, " ")}</td>
                  <td className="py-2">
                    <span className="badge badge-muted">{rule.channel}</span>
                  </td>
                  <td className="py-2">{formatConfig(rule)}</td>
                  <td className="py-2">
                    <span className={rule.enabled ? "badge badge-ok" : "badge badge-muted"}>
                      {rule.enabled ? "ON" : "OFF"}
                    </span>
                  </td>
                  {isAdmin ? (
                    <td className="flex gap-2 py-2">
                      <button
                        className="btn-secondary text-xs"
                        onClick={() => toggleRule(rule.id, rule.enabled)}
                      >
                        {rule.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        className="btn-secondary text-xs text-red-600"
                        onClick={() => deleteRule(rule.id)}
                      >
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
