import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/app");
  }

  redirect("/login");
}
