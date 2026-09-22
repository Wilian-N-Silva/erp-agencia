import { notFound, redirect } from "next/navigation";

import { listAccessRecords } from "@/features/accesses/dal";
import { listDocuments } from "@/features/documents/dal";
import { listEquipment } from "@/features/equipment/dal";
import { canWriteEquipment } from "@/features/equipment/rules";
import { toDateKey } from "@/features/finance/rules";
import { listLifecycleChecklists } from "@/features/lifecycle/dal";
import { canWriteLifecycle } from "@/features/lifecycle/rules";
import {
  getEmployeeDetail,
  listCompensationHistory,
  listEmployeeAuditLogs,
  listEmployeeBenefits,
  listPeopleOptions,
} from "@/features/people/dal";
import { canWritePeople } from "@/features/people/rules";
import { listInvoiceRequests, listReimbursements } from "@/features/portal/dal";
import {
  listTimeOffRequests,
  summarizeEmployeeVacation,
} from "@/features/timeoff/dal";
import { canCreateOwnTimeOff } from "@/features/timeoff/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";

import { EmployeeDetailView } from "./employee-detail-view";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EmployeeDetailPage({ params }: PageProps) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const employee = await getEmployeeDetail(context, id);

  if (!employee) {
    notFound();
  }

  const canWrite = canWritePeople(context);
  const canManageLifecycle = canWriteLifecycle(context);
  const canManageEquipment = canWriteEquipment(context);
  const canReadTimeOff = canAny(
    ["timeoff.read", "timeoff.write", "timeoff.read_team", "timeoff.read_own"],
    context,
  );
  const canReadEquipment = canAny(
    ["equipment.read", "equipment.write", "equipment.configure", "equipment.read_team", "equipment.read_own"],
    context,
  );
  const canReadAccesses = canAny(
    [
      "access_records.read",
      "access_records.write",
      "access_records.configure",
      "access_records.read_team",
      "access_records.read_own",
    ],
    context,
  );
  const canReadInvoices = canAny(
    ["invoices.read", "invoices.write", "invoices.approve", "invoices.read_own"],
    context,
  );
  const canReadReimbursements = canAny(
    [
      "reimbursements.read",
      "reimbursements.write",
      "reimbursements.approve_team",
      "reimbursements.approve_finance",
      "reimbursements.read_own",
    ],
    context,
  );
  const canReadDocuments = canAny(
    ["documents.read_sensitive", "documents.write", "documents.read_own"],
    context,
  );

  const [
    options,
    auditLogs,
    compensationHistory,
    benefits,
    vacationSummary,
    timeOffRequests,
    equipmentItems,
    accessRecords,
    invoiceRequests,
    reimbursements,
    offboardingChecklists,
    documents,
  ] = await Promise.all([
    canWrite ? listPeopleOptions(context) : Promise.resolve(null),
    listEmployeeAuditLogs(context, employee.id, { limit: 12 }),
    listCompensationHistory(context, employee.id),
    listEmployeeBenefits(context, employee.id),
    canReadTimeOff
      ? summarizeEmployeeVacation(context, employee.id)
      : Promise.resolve({ current: null, history: [] }),
    canReadTimeOff ? listTimeOffRequests(context) : Promise.resolve([]),
    canReadEquipment ? listEquipment(context) : Promise.resolve([]),
    canReadAccesses ? listAccessRecords(context) : Promise.resolve([]),
    canReadInvoices ? listInvoiceRequests(context) : Promise.resolve([]),
    canReadReimbursements ? listReimbursements(context) : Promise.resolve([]),
    canManageLifecycle ? listLifecycleChecklists(context, "offboarding") : Promise.resolve([]),
    canReadDocuments
      ? listDocuments(context, { ownerEmployeeId: employee.id })
      : Promise.resolve([]),
  ]);
  const hasOpenOffboarding = offboardingChecklists.some(
    (checklist) => checklist.employeeId === employee.id && checklist.status === "open",
  );
  const isOwnEmployee = Boolean(context.employeeId && context.employeeId === employee.id);
  const isActiveEmployee = employee.status !== "terminated";

  return (
    <EmployeeDetailView
      employee={{
        ...employee,
        managerEmployeeId: employee.managerEmployeeId ?? null,
        managerName: employee.managerName ?? null,
        startDate: toDateKey(employee.startDate),
        endDate: employee.endDate ? toDateKey(employee.endDate) : null,
        birthDate: employee.birthDate ? toDateKey(employee.birthDate) : null,
        updatedAt: employee.updatedAt.toISOString(),
      }}
      options={options}
      actions={{
        canAssignEquipment: canManageEquipment && isActiveEmployee,
        canEdit: canWrite && Boolean(options),
        canExportProfile: true,
        canRegisterReimbursement:
          isOwnEmployee && isActiveEmployee && can("reimbursements.read_own", context),
        canRequestTimeOff:
          isOwnEmployee && isActiveEmployee && canCreateOwnTimeOff(context),
        canStartOffboarding:
          canManageLifecycle && isActiveEmployee && !hasOpenOffboarding,
        canUploadDocument: can("documents.write", context),
      }}
      auditLogs={auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        actorName: log.actorName,
        actorEmail: log.actorEmail,
        createdAt: log.createdAt.toISOString(),
      }))}
      compensationHistory={compensationHistory.map((item) => ({
        id: item.id,
        previousAmount: item.previousAmount,
        newAmount: item.newAmount,
        differenceAmount: item.differenceAmount,
        effectiveDate: item.effectiveDate,
        reason: item.reason,
        approvedByName: item.approvedByName,
        createdByName: item.createdByName,
        createdAt: item.createdAt.toISOString(),
        compensationHidden: item.compensationHidden,
      }))}
      benefits={benefits.map((benefit) => ({
        id: benefit.id,
        benefitType: benefit.benefitType,
        name: benefit.name,
        amount: benefit.amount,
        recurring: benefit.recurring,
        startDate: benefit.startDate,
        endDate: benefit.endDate,
        status: benefit.status,
        notes: benefit.notes,
        activeForComposition: benefit.activeForComposition,
        compensationHidden: benefit.compensationHidden,
      }))}
      vacationSummary={{
        current: vacationSummary.current
          ? serializeVacationBalance(vacationSummary.current)
          : null,
        history: vacationSummary.history.map(serializeVacationBalance),
      }}
      timeOffRequests={timeOffRequests
        .filter((request) => request.employeeId === employee.id)
        .map((request) => ({
          id: request.id,
          type: request.type,
          startDate: request.startDate,
          endDate: request.endDate,
          businessDays: request.businessDays,
          soldDays: request.soldDays,
          status: request.status,
          notes: request.notes,
        }))}
      equipmentItems={equipmentItems
        .filter((item) => item.currentEmployeeId === employee.id)
        .map((item) => ({
          id: item.id,
          assetNumber: item.assetNumber,
          type: item.type,
          brand: item.brand,
          model: item.model,
          serialNumber: item.serialNumber,
          status: item.status,
          notes: item.notes,
          returnAlert: item.returnAlert,
        }))}
      assignableEquipmentItems={equipmentItems
        .filter((item) => item.status !== "retired" && item.currentEmployeeId !== employee.id)
        .map((item) => ({
          id: item.id,
          assetNumber: item.assetNumber,
          type: item.type,
          brand: item.brand,
          model: item.model,
          status: item.status,
          currentEmployeeName: item.currentEmployeeName,
        }))}
      documents={documents.map((document) => ({
        id: document.id,
        ownerType: document.ownerType,
        documentType: document.documentType,
        originalName: document.originalName,
        extension: document.extension,
        byteSize: document.byteSize,
        sensitivity: document.sensitivity,
        visibility: document.visibility,
        version: document.version,
        status: document.status,
        createdAt: document.createdAt.toISOString(),
      }))}
      accessRecords={accessRecords
        .filter((record) => record.employeeId === employee.id)
        .map((record) => ({
          id: record.id,
          platform: record.platform,
          accountIdentifier: record.accountIdentifier,
          accessLevel: record.accessLevel,
          critical: record.critical,
          status: record.status,
          reviewDueDate: record.reviewDueDate
            ? toDateKey(record.reviewDueDate)
            : null,
          responsibleUserName: record.responsibleUserName,
          reviewState: record.reviewState,
          alert: record.alert,
        }))}
      invoiceRequests={invoiceRequests
        .filter((invoice) => invoice.employeeId === employee.id)
        .map((invoice) => ({
          id: invoice.id,
          competence: invoice.competence,
          dueDate: invoice.dueDate,
          expectedAmount: invoice.expectedAmount,
          issuedAmount: invoice.issuedAmount,
          status: invoice.status,
          divergence: invoice.divergence,
        }))}
      reimbursements={reimbursements
        .filter((reimbursement) => reimbursement.employeeId === employee.id)
        .map((reimbursement) => ({
          id: reimbursement.id,
          title: reimbursement.title,
          category: reimbursement.category,
          amount: reimbursement.amount,
          expenseDate: reimbursement.expenseDate,
          status: reimbursement.status,
          includedInvoiceRequestId: reimbursement.includedInvoiceRequestId,
          paidAt: reimbursement.paidAt?.toISOString() ?? null,
        }))}
    />
  );
}

function serializeVacationBalance(balance: {
  id: string;
  periodStart: string;
  periodEnd: string;
  concessionDeadline: string;
  daysAcquired: number;
  daysSold: number;
  daysTaken: number;
  daysAvailable: number;
  status: "active" | "closed";
  expiring: boolean;
  expired: boolean;
  notes: string | null;
}) {
  return {
    id: balance.id,
    periodStart: balance.periodStart,
    periodEnd: balance.periodEnd,
    concessionDeadline: balance.concessionDeadline,
    daysAcquired: balance.daysAcquired,
    daysSold: balance.daysSold,
    daysTaken: balance.daysTaken,
    daysAvailable: balance.daysAvailable,
    status: balance.status,
    expiring: balance.expiring,
    expired: balance.expired,
    notes: balance.notes,
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
