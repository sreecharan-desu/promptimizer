import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/server/account";
import { authConfigured, googleAuthConfigured } from "@/server/db";

export const metadata = { title: "Create account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  if (authConfigured()) {
    const user = await getCurrentUser();
    if (user) redirect(next && next.startsWith("/") ? next : "/account");
  }
  return (
    <AuthForm
      mode="signup"
      next={next}
      configured={authConfigured()}
      google={googleAuthConfigured()}
      errorCode={error}
    />
  );
}
