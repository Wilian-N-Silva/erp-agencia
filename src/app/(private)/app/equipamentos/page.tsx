import { Ban, CheckCircle2, Laptop, RotateCcw, UserPlus, Wrench } from "lucide-react";
import { redirect } from "next/navigation";

import { ActionDialog } from "@/components/ui/action-dialog";
import {
  assignEquipmentAction,
  createEquipmentAction,
  markEquipmentMaintenanceAction,
  retireEquipmentAction,
  returnEquipmentAction,
} from "@/features/equipment/actions";
import {
  listEquipment,
  listEquipmentEmployeeOptions,
  type EquipmentEmployeeOption,
  type EquipmentListItem,
} from "@/features/equipment/dal";
import {
  canReturnEquipment,
  canWriteEquipment,
  equipmentStatusLabels,
  normalizeEquipmentFilters,
  type EquipmentFilters,
  type EquipmentStatus,
} from "@/features/equipment/rules";
import { formatDate } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EquipmentPage({ searchParams }: PageProps) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canAny(["equipment.read", "equipment.write", "equipment.configure", "equipment.read_team"], context)) {
    redirect("/acesso-negado");
  }

  const filters = normalizeEquipmentFilters((await searchParams) ?? {});
  const canWrite = canWriteEquipment(context);
  const [items, employeeOptions] = await Promise.all([
    listEquipment(context, filters),
    canWrite ? listEquipmentEmployeeOptions(context) : Promise.resolve([]),
  ]);
  const inUse = items.filter((item) => item.status === "in_use").length;
  const alerts = items.filter((item) => item.returnAlert).length;

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">Equipamentos</h1>
        <p className="text-sm text-muted-foreground">Patrimonio, responsaveis e devolucoes</p>
      </div>

      <EquipmentFilterForm filters={filters} />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Patrimonios" value={String(items.length)} />
        <SummaryCard label="Em uso" value={String(inUse)} />
        <SummaryCard label="Alertas" value={String(alerts)} />
      </div>

      {canWrite ? (
        <div className="flex justify-end">
          <ActionDialog
            title="Cadastrar equipamento"
            trigger={
              <>
                <Laptop className="size-4" aria-hidden="true" />
                Cadastrar equipamento
              </>
            }
            triggerClassName={`${primaryButtonClassName} sm:w-auto`}
            triggerLabel="Cadastrar equipamento"
          >
            <EquipmentForm employeeOptions={employeeOptions} />
          </ActionDialog>
        </div>
      ) : null}

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Inventario</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Patrimonio</th>
                <th className="px-4 py-3 font-medium">Equipamento</th>
                <th className="px-4 py-3 font-medium">Responsavel</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Atualizado</th>
                {canWrite ? <th className="px-4 py-3 text-right font-medium">Acoes</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={canWrite ? 6 : 5}>
                    Nenhum equipamento cadastrado.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <EquipmentRow
                    canWrite={canWrite}
                    employeeOptions={employeeOptions}
                    item={item}
                    key={item.id}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function EquipmentFilterForm({ filters }: { filters: EquipmentFilters }) {
  return (
    <form action="/app/equipamentos" className="rounded-lg border bg-card p-4" method="get">
      <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_minmax(10rem,0.35fr)_auto_auto]">
        <label className={fieldClassName}>
          Busca
          <input
            className={inputClassName}
            defaultValue={filters.query ?? ""}
            name="q"
            placeholder="Patrimonio, tipo, serie"
          />
        </label>
        <label className={fieldClassName}>
          Status
          <select className={inputClassName} defaultValue={filters.status ?? "all"} name="status">
            <option value="all">Todos</option>
            {Object.entries(equipmentStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className={`${primaryButtonClassName} self-end`} type="submit">
          Filtrar
        </button>
        <a className={`${secondaryButtonClassName} self-end`} href="/app/equipamentos">
          Limpar
        </a>
      </div>
    </form>
  );
}

function EquipmentForm({ employeeOptions }: { employeeOptions: EquipmentEmployeeOption[] }) {
  return (
    <form action={createEquipmentAction} className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Tipo
          <input className={inputClassName} maxLength={80} name="type" required />
        </label>
        <label className={fieldClassName}>
          Marca
          <input className={inputClassName} maxLength={80} name="brand" />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Modelo
          <input className={inputClassName} maxLength={120} name="model" />
        </label>
        <label className={fieldClassName}>
          Serie
          <input className={inputClassName} maxLength={120} name="serialNumber" />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Status
          <select className={inputClassName} defaultValue="available" name="status">
            {Object.entries(equipmentStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Responsavel
          <select className={inputClassName} name="currentEmployeeId">
            <option value="">Sem responsavel</option>
            {employeeOptions.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={fieldClassName}>
        Observacao
        <textarea className={textareaClassName} maxLength={1000} name="notes" rows={4} />
      </label>
      <div className="flex justify-end">
        <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
          <Laptop className="size-4" aria-hidden="true" />
          Cadastrar equipamento
        </button>
      </div>
    </form>
  );
}

function EquipmentRow({
  canWrite,
  employeeOptions,
  item,
}: {
  canWrite: boolean;
  employeeOptions: EquipmentEmployeeOption[];
  item: EquipmentListItem;
}) {
  const canReturn = canReturnEquipment({
    currentEmployeeId: item.currentEmployeeId,
    status: item.status,
  });

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3 font-medium">{item.assetNumber}</td>
      <td className="px-4 py-3">
        <p className="font-medium">{item.type}</p>
        <p className="text-xs text-muted-foreground">
          {[item.brand, item.model, item.serialNumber].filter(Boolean).join(" / ") || "-"}
        </p>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{item.currentEmployeeName ?? "-"}</td>
      <td className="px-4 py-3">
        <StatusBadge alert={item.returnAlert} status={item.status} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(item.updatedAt)}</td>
      {canWrite ? (
        <td className="px-4 py-3">
          <div className="flex flex-wrap justify-end gap-2">
            <ActionDialog
              title="Atribuir equipamento"
              trigger={<UserPlus className="size-4" aria-hidden="true" />}
              triggerClassName={iconButtonClassName("primary")}
              triggerLabel="Atribuir equipamento"
            >
              <AssignEquipmentForm
                currentEmployeeId={item.currentEmployeeId}
                employeeOptions={employeeOptions}
                id={item.id}
              />
            </ActionDialog>
            {canReturn ? (
              <form action={returnEquipmentAction}>
                <input name="id" type="hidden" value={item.id} />
                <IconButton icon={RotateCcw} label="Registrar devolucao" tone="primary" />
              </form>
            ) : null}
            {item.status !== "maintenance" && item.status !== "retired" ? (
              <form action={markEquipmentMaintenanceAction}>
                <input name="id" type="hidden" value={item.id} />
                <IconButton icon={Wrench} label="Manutencao" tone="warning" />
              </form>
            ) : null}
            {item.status !== "retired" ? (
              <form action={retireEquipmentAction}>
                <input name="id" type="hidden" value={item.id} />
                <IconButton icon={Ban} label="Descartar" tone="destructive" />
              </form>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}

function AssignEquipmentForm({
  currentEmployeeId,
  employeeOptions,
  id,
}: {
  currentEmployeeId: string | null;
  employeeOptions: EquipmentEmployeeOption[];
  id: string;
}) {
  return (
    <form action={assignEquipmentAction} className="grid gap-4">
      <input name="id" type="hidden" value={id} />
      <label className={fieldClassName}>
        Responsavel
        <select className={inputClassName} defaultValue={currentEmployeeId ?? ""} name="employeeId" required>
          <option value="">Selecionar</option>
          {employeeOptions.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex justify-end">
        <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
          <UserPlus className="size-4" aria-hidden="true" />
          Atribuir
        </button>
      </div>
    </form>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ alert, status }: { alert: boolean; status: EquipmentStatus }) {
  const className = alert
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : status === "in_use"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "retired"
        ? "border-muted bg-muted text-muted-foreground"
        : "border-secondary/30 bg-secondary/10 text-secondary-foreground";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {equipmentStatusLabels[status]}
    </span>
  );
}

function IconButton({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  tone: "destructive" | "primary" | "warning";
}) {
  return (
    <button
      aria-label={label}
      className={iconButtonClassName(tone)}
      title={label}
      type="submit"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function iconButtonClassName(tone: "destructive" | "primary" | "warning") {
  const className =
    tone === "primary"
      ? "border-primary/30 text-primary hover:bg-primary/10"
      : tone === "warning"
        ? "border-secondary/30 text-secondary-foreground hover:bg-secondary/10"
        : "border-destructive/30 text-destructive hover:bg-destructive/10";

  return `inline-flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors ${className}`;
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const textareaClassName =
  "min-h-24 w-full min-w-0 resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

const secondaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
