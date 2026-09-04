import { redirect } from "next/navigation";
import { AccountApp } from "@/components/account-app";
import { getCurrentUser, listKeys } from "@/server/account";
import { authConfigured } from "@/server/db";

export const metadata = { title: "API keys" };

export default async function AccountPage() {
  if (!authConfigured()) redirect("/signup");
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const keys = await listKeys(user.id);
  return (
    <AccountApp
      user={user}
      keys={keys.map((k) => ({
        id: String(k.id),
        name: String(k.name),
        prefix: String(k.prefix),
        last_used_at: k.last_used_at ? String(k.last_used_at) : null,
        created_at: String(k.created_at),
      }))}
    />
  );
}
