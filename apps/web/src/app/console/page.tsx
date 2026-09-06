import { redirect } from "next/navigation";
import { ConsoleApp } from "@/components/console-app";
import { getCurrentUser } from "@/server/account";
import { authConfigured } from "@/server/db";

export const metadata = {
  title: "Console",
};

export default async function ConsolePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  if (authConfigured()) {
    const user = await getCurrentUser();
    if (!user) redirect("/login?next=/console");
  }
  const params = searchParams ? await searchParams : undefined;
  return <ConsoleApp initialTab={params?.tab} />;
}
