"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function InvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const accepted = useRef(false);

  useEffect(() => {
    if (accepted.current) return;
    if (!token) {
      setStatus("error");
      setMessage("Invalid invitation link: no token provided.");
      return;
    }

    async function accept() {
      try {
        const res = await fetch("/api/invitations/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });

        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
          setMessage(data.error ?? "Failed to accept invitation");
          return;
        }

        setStatus("success");
        setMessage("Invitation accepted! Redirecting to dashboard...");
        setTimeout(() => router.push("/dashboard"), 1500);
      } catch {
        setStatus("error");
        setMessage("Failed to accept invitation");
      }
    }

    accepted.current = true;
    void accept();
  }, [token, router]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="card text-center">
        <h1 className="text-lg font-semibold">Accept Invitation</h1>
        <div className="mt-4">
          {status === "loading" ? (
            <div className="space-y-2">
              <div className="skeleton mx-auto h-4 w-48" />
              <p className="text-sm text-slate-500">Processing invitation...</p>
            </div>
          ) : status === "success" ? (
            <p className="text-sm text-emerald-700">{message}</p>
          ) : (
            <p className="text-sm text-red-700">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
