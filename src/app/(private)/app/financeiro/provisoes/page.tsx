import { renderFinancePage } from "../finance-page";
import Link from "next/link";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FinanceProvisoesPage({ searchParams }: PageProps) {
  const content = await renderFinancePage({ searchParams, initialTab: "provisoes" });
  return <><div className="px-6 pt-4"><Link className="text-primary underline" href="/app/financeiro/provisoes/ciclos">Gerenciar ocorrências por competência</Link></div>{content}</>;
}
