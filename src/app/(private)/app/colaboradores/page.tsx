import { redirect } from "next/navigation";

import { toDateKey } from "@/features/finance/rules";
import { listEmployees, listPeopleFilterOptions } from "@/features/people/dal";
import { normalizePeopleFilters } from "@/features/people/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";

import { PeopleView } from "./people-view";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PeoplePage({ searchParams }: PageProps) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canAny(["people.read", "people.read_team", "people.read_own", "people.configure"], context)) {
    redirect("/acesso-negado");
  }

  const filters = normalizePeopleFilters((await searchParams) ?? {});
  const [employees, filterOptions] = await Promise.all([
    listEmployees(context),
    listPeopleFilterOptions(context),
  ]);

  return (
    <PeopleView
      employees={employees.map((employee) => ({
        ...employee,
        startDate: toDateKey(employee.startDate),
      }))}
      filterOptions={filterOptions}
      initialFilters={filters}
      canWrite={canAny(["people.write", "people.configure"], context)}
    />
  );
}
