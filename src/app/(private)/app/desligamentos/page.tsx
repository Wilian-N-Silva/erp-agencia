import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function OffboardingPage() {
  redirect("/app/colaboradores/desligamentos");
}
