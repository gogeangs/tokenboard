"use client";

import { FormEvent, useMemo, useState } from "react";
import type { WorkspaceOption } from "@/types/app";

type Props = {
  workspaces: WorkspaceOption[];
};

export function SettingsClient({ workspaces }: Props) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [adminKey, setAdminKey] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("usd");
  const [message, setMessage] = useState<string | null>(null);

  const month = useMemo(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }, []);

  async function connectOpenAI(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/openai/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, adminKey })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error ?? "OpenAI connect failed");
    setAdminKey("");
    setMessage("OpenAI key saved. Sync queued.");
  }

  async function saveBudget(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    const parsed = Number(amount);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setMessage("Budget amount must be positive");
      return;
    }

    const res = await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, month, amount: parsed, currency })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error ?? "Budget save failed");
    setMessage("Budget saved.");
  }

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between">
        <h1 className="text-lg font-semibold">Settings</h1>
        <select className="input max-w-xs" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.displayName}
            </option>
          ))}
        </select>
      </div>

      {message && <p className="text-sm text-slate-700">{message}</p>}

      <form className="card space-y-3" onSubmit={connectOpenAI}>
        <h2 className="text-base font-semibold">OpenAI Connection</h2>
        <p className="text-sm text-slate-600">Save workspace-level OpenAI Admin API key.</p>
        <input
          className="input"
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="sk-admin-..."
          required
        />
        <button className="btn" type="submit">
          Save OpenAI Key
        </button>
      </form>

      <form className="card space-y-3" onSubmit={saveBudget}>
        <h2 className="text-base font-semibold">Monthly Budget</h2>
        <p className="text-sm text-slate-600">Month: {month}</p>
        <input
          className="input"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100.00"
          required
        />
        <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="usd" required />
        <button className="btn" type="submit">
          Save Budget
        </button>
      </form>
    </div>
  );
}
