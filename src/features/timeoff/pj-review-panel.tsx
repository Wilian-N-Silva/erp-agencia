import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { Card } from "@/components/fg";
import { db, withTenantDb } from "@/lib/db";
import { employees, timeOffRequests, users } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { can } from "@/lib/rbac";
import { formatDate } from "@/features/finance/rules";
import { getPjApproverId } from "./pj-policy";
import { PjApproverForm, PjReviewForm } from "./pj-forms";
import { calculateCalendarDays } from "./rules";

export async function PjReviewPanel({ context }: { context: AccessContext }) {
  if (!context.organizationId || (!can("settings.manage", context) && !can("timeoff.write", context))) return null;
  const approver = await getPjApproverId(context);
  const data = await withTenantDb(context, async () => {
    const options = can("settings.manage", context) ? await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.organizationId, context.organizationId!), eq(users.accessStatus, "active"), eq(users.isActive, true))).orderBy(asc(users.name)) : [];
    const requests = approver === context.userId && can("timeoff.write", context) ? await db.select({
      id: timeOffRequests.id, type: timeOffRequests.type, days: timeOffRequests.soldDays, startDate: timeOffRequests.startDate, endDate: timeOffRequests.endDate,
      name: employees.fullName, notes: timeOffRequests.notes, base: employees.currentCompensation,
    }).from(timeOffRequests).innerJoin(employees, and(eq(employees.id, timeOffRequests.employeeId), eq(employees.organizationId, timeOffRequests.organizationId)))
      .where(and(eq(timeOffRequests.organizationId, context.organizationId!), eq(employees.employmentType, "pj"), isNull(employees.deletedAt), eq(timeOffRequests.status, "requested"), ne(timeOffRequests.type, "absence"))).orderBy(asc(timeOffRequests.createdAt)) : [];
    return { options, requests: requests.map(row => ({ ...row, base: can("compensation.read", context) ? row.base : null })) };
  });
  return <Card title="Aprovações de férias e venda de dias PJ">
    {can("settings.manage", context) ? <PjApproverForm users={data.options} current={approver} /> : null}
    {!approver ? <p>Configure a conta da Jaci para liberar as aprovações PJ.</p> : approver !== context.userId ? <p>As solicitações PJ aguardam a responsável configurada.</p> : null}
    {data.requests.map(request => <section key={request.id} style={{ marginTop: 24 }}>
      <h3>{request.name} · {request.type === "sale" ? `Venda de ${request.days} dias` : `Descanso de ${calculateCalendarDays(request.startDate, request.endDate)} dias corridos`}</h3>
      {request.type !== "sale" ? <p>{formatDate(request.startDate)} a {formatDate(request.endDate)}</p> : null}
      <p>{request.notes}</p>
      <PjReviewForm id={request.id} base={request.base} days={request.days} sale={request.type === "sale"} />
    </section>)}
  </Card>;
}
