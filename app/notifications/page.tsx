"use client";

import { useEffect, useState } from "react";

type Notification = {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  workspaceName: string;
  createdAt: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/notifications?limit=100");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function markAsRead(id: string) {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      if (!res.ok) return;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      // fail silently
    }
  }

  async function markAllAsRead() {
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      if (!res.ok) return;
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // fail silently
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between">
        <h1 className="text-lg font-semibold">All Notifications</h1>
        <button className="btn-secondary text-xs" onClick={markAllAsRead}>
          Mark all read
        </button>
      </div>

      {loading ? (
        <div className="card space-y-2">
          <div className="skeleton h-8 w-full" />
          <div className="skeleton h-8 w-full" />
          <div className="skeleton h-8 w-full" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="card">
          <p className="text-sm text-slate-500">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              type="button"
              key={n.id}
              className={`card w-full text-left ${n.read ? "opacity-60" : ""}`}
              onClick={() => !n.read && markAsRead(n.id)}
              disabled={n.read}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{n.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{n.body}</p>
                </div>
                {!n.read ? (
                  <span className="mt-1 h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
                ) : null}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {n.workspaceName} &middot; {n.type.replace(/_/g, " ")} &middot;{" "}
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
