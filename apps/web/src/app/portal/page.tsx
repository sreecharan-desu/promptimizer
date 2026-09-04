import { redirect } from "next/navigation";
import { PortalApp } from "@/components/portal-app";
import { getCurrentUser, savingsForUser } from "@/server/account";
import { authConfigured } from "@/server/db";

export const metadata = { title: "Savings" };
export const dynamic = "force-dynamic";

export default async function PortalPage() {
  if (!authConfigured()) redirect("/signup");
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/portal");
  return <PortalApp user={user} savings={await savingsForUser(user.id)} />;
}
