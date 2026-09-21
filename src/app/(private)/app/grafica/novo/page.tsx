import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RateLimitedActionForm } from "@/components/fg";
import { createGraphicJobAction } from "@/features/graphics/actions";
import { getGraphicJobFormOptions } from "@/features/graphics/dal";
import { canWriteGraphicJobs } from "@/features/graphics/rules";
import { getCurrentAccessContext } from "@/lib/dal";

import { GraphicJobFormFields } from "../job-form";

export const dynamic = "force-dynamic";

export default async function NewGraphicJobPage() {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!canWriteGraphicJobs(context)) redirect("/acesso-negado");
  const options = await getGraphicJobFormOptions(context);

  return <section className="flex w-full flex-col gap-6">
    <div><Link className={secondaryButtonClassName} href="/app/grafica"><ArrowLeft size={16} />Voltar</Link><h1 className="mt-4 text-2xl font-semibold">Novo trabalho da Gráfica</h1><p className="text-sm text-muted-foreground">Registre a demanda antes de existir uma OS.</p></div>
    <RateLimitedActionForm action={createGraphicJobAction} className="rounded-lg border bg-card p-5">
      <GraphicJobFormFields options={options} />
      <div className="mt-5 flex justify-end"><button className={primaryButtonClassName} type="submit"><Plus size={16} />Criar trabalho</button></div>
    </RateLimitedActionForm>
  </section>;
}

const primaryButtonClassName = "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground";
const secondaryButtonClassName = "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted";
