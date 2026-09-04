import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/server/account";
import { authConfigured } from "@/server/db";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (authConfigured()) {
    const user = await getCurrentUser();
    if (user) redirect(next && next.startsWith("/") ? next : "/console");
  }
  return <AuthForm mode="login" next={next} configured={authConfigured()} />;
}
