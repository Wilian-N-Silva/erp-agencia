import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "./index";

export type CurrentSession = Awaited<ReturnType<typeof getCurrentSession>>;

export async function getCurrentSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireCurrentSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}
