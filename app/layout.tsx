import "./globals.css";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton } from "@/app/components/LogoutButton";
import { NotificationBell } from "@/app/components/NotificationBell";

export const metadata = {
  title: "TokenBoard",
  description: "OpenAI usage and cost dashboard"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();

  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="font-semibold">TokenBoard</div>
            <nav className="flex items-center gap-4 text-sm">
              {user ? (
                <>
                  <Link href="/dashboard">Dashboard</Link>
                  <Link href="/breakdown">Breakdown</Link>
                  <Link href="/analytics">Analytics</Link>
                  <Link href="/members">Members</Link>
                  <Link href="/alerts">Alerts</Link>
                  <NotificationBell />
                  <Link href="/settings">Settings</Link>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link href="/login">Login</Link>
                  <Link href="/register">Register</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
