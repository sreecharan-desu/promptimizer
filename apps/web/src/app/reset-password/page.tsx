import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { getCurrentUser } from "@/server/account";
import { authConfigured } from "@/server/db";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (authConfigured()) {
    const user = await getCurrentUser();
    if (user) redirect("/account");
  }
  return <ResetPasswordForm token={token ?? ""} />;
}
