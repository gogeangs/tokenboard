"use client";

import { useEffect, useState } from "react";
import type { WorkspaceOption } from "@/types/app";

type Member = {
  userId: string;
  email: string;
  role: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
};

type Props = {
  workspaces: WorkspaceOption[];
};

const ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;

function roleBadge(role: string) {
  if (role === "OWNER") return "badge badge-ok";
  if (role === "ADMIN") return "badge badge-warn";
  return "badge badge-muted";
}

export function MembersClient({ workspaces }: Props) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("MEMBER");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);

  const selectedWorkspace = workspaces.find((w) => w.id === workspaceId);
  const isOwner = selectedWorkspace?.role === "OWNER";
  const isAdmin = selectedWorkspace?.role === "OWNER" || selectedWorkspace?.role === "ADMIN";

  async function loadMembers() {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/members`),
        isAdmin ? fetch(`/api/workspaces/${workspaceId}/invitations`) : Promise.resolve(null)
      ]);

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members);
      }

      if (invitationsRes && invitationsRes.ok) {
        const data = await invitationsRes.json();
        setInvitations(data.invitations);
      } else {
        setInvitations([]);
      }
    } catch {
      setMessage("Failed to load members");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMembers();
  }, [workspaceId]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Failed to invite");
        setMessageType("error");
        return;
      }

      setMessage(`Invitation sent to ${inviteEmail}. Token: ${data.invitation.token}`);
      setMessageType("success");
      setInviteEmail("");
      void loadMembers();
    } catch {
      setMessage("Failed to invite");
      setMessageType("error");
    }
  }

  async function changeRole(userId: string, newRole: string) {
    setMessage(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole })
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Failed to change role");
        setMessageType("error");
        return;
      }

      void loadMembers();
    } catch {
      setMessage("Failed to change role");
      setMessageType("error");
    }
  }

  async function removeMember(userId: string) {
    if (!confirm("Are you sure you want to remove this member?")) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Failed to remove member");
        setMessageType("error");
        return;
      }

      void loadMembers();
    } catch {
      setMessage("Failed to remove member");
      setMessageType("error");
    }
  }

  async function revokeInvitation(id: string) {
    setMessage(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invitations/${id}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error ?? "Failed to revoke");
        setMessageType("error");
        return;
      }

      void loadMembers();
    } catch {
      setMessage("Failed to revoke invitation");
      setMessageType("error");
    }
  }

  if (!workspaces.length) {
    return <p>No workspace found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-lg font-semibold">Members</h1>
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
        <div className="card">
          <p className="mb-3 text-base font-semibold">Invite Member</p>
          <form onSubmit={invite} className="flex flex-col gap-2 md:flex-row">
            <input
              type="email"
              className="input md:flex-1"
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
            <select
              className="input md:w-36"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <button type="submit" className="btn">
              Send Invite
            </button>
          </form>
        </div>
      ) : null}

      <div className="card">
        <p className="mb-3 text-base font-semibold">Current Members</p>
        {loading ? (
          <div className="space-y-2">
            <div className="skeleton h-8 w-full" />
            <div className="skeleton h-8 w-full" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Workspace members</caption>
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                {isOwner ? <th className="py-2">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId} className="border-b border-slate-100">
                  <td className="py-2">{m.email}</td>
                  <td className="py-2">
                    {isOwner ? (
                      <select
                        className="input w-32"
                        value={m.role}
                        onChange={(e) => changeRole(m.userId, e.target.value)}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={roleBadge(m.role)}>{m.role}</span>
                    )}
                  </td>
                  {isOwner ? (
                    <td className="py-2">
                      <button
                        className="btn-secondary text-xs text-red-600"
                        onClick={() => removeMember(m.userId)}
                      >
                        Remove
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isAdmin && invitations.length > 0 ? (
        <div className="card">
          <p className="mb-3 text-base font-semibold">Pending Invitations</p>
          <table className="w-full text-sm">
            <caption className="sr-only">Pending invitations</caption>
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Expires</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-100">
                  <td className="py-2">{inv.email}</td>
                  <td className="py-2">
                    <span className={roleBadge(inv.role)}>{inv.role}</span>
                  </td>
                  <td className="py-2">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                  <td className="py-2">
                    <button
                      className="btn-secondary text-xs text-red-600"
                      onClick={() => revokeInvitation(inv.id)}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
