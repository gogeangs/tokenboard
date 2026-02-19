"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <button className="btn-secondary" type="button" onClick={onLogout}>
      Logout
    </button>
  );
}
