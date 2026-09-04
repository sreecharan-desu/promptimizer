import { redirect } from "next/navigation";
import { VerifyEmail } from "@/components/verify-email";
import { getCurrentUser } from "@/server/account";
import { authConfigured } from "@/server/db";

export const metadata = { title: "Verify email" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const { email, error } = await searchParams;
  if (authConfigured()) {
    const user = await getCurrentUser();
    if (user) redirect("/console");
  }
  return <VerifyEmail email={email} error={error} />;
}
