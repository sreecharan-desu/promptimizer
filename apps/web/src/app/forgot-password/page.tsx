import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { getCurrentUser } from "@/server/account";
import { authConfigured } from "@/server/db";

export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  if (authConfigured()) {
    const user = await getCurrentUser();
    if (user) redirect("/account");
  }
  return <ForgotPasswordForm />;
}
