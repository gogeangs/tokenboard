import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { AuthForm } from "@/app/components/AuthForm";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="space-y-4">
      <AuthForm mode="login" />
      <p className="text-center text-sm text-slate-600">
        No account? <Link className="underline" href="/register">Register</Link>
      </p>
    </div>
  );
}
