import { redirect } from "next/navigation";

import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const context = await getCurrentAccessContext();

  if (context) {
    redirect("/app");
  }

  redirect("/login");
}
