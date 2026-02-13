import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { AuthForm } from "@/app/components/AuthForm";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="space-y-4">
      <AuthForm mode="register" />
      <p className="text-center text-sm text-slate-600">
        Already registered? <Link className="underline" href="/login">Login</Link>
      </p>
    </div>
  );
}
