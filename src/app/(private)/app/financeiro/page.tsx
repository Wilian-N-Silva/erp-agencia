import { renderFinancePage } from "./finance-page";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FinancePage({ searchParams }: PageProps) {
  return renderFinancePage({ searchParams, initialTab: "entradas" });
}
