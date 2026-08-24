import { Link2, Plus, RefreshCw, Save, Send, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";

import { ActionDialog } from "@/components/ui/action-dialog";
import { RateLimitedActionForm } from "@/components/fg";
import { createAccessInvitationAction } from "@/features/access-invitations/actions";
import {
  listAccessInvitations,
  type AccessInvitationListItem,
} from "@/features/access-invitations/dal";
import {
  getAccessInvitationState,
  invitationExpiryOptions,
  type AccessInvitationState,
} from "@/features/access-invitations/rules";
import {
  createAreaAction,
  createPositionAction,
  deleteAreaAction,
  deletePositionAction,
  updateAppSettingAction,
  updateSettingsUserEmployeeLinkAction,
  updateSettingsUserRolesAction,
  updateSettingsUserStatusAction,
} from "@/features/settings/actions";
import {
  getSettingsDashboard,
  type AppSettingListItem,
  type SettingsOrgUnitItem,
  type SettingsEmployeeOption,
  type SettingsPermissionItem,
  type SettingsRoleItem,
  type SettingsUserListItem,
} from "@/features/settings/dal";
import {
  canManageSettings,
  canReadSettings,
  settingLabels,
  stringifySettingValue,
} from "@/features/settings/rules";
import { formatDate } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { roleLabels, type RoleKey } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canReadSettings(context)) {
    redirect("/acesso-negado");
  }

  const [dashboard, invitations] = await Promise.all([
    getSettingsDashboard(context),
    listAccessInvitations(context),
  ]);
  const canManage = canManageSettings(context);

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-normal">Configuracoes</h1>
          <p className="text-sm text-muted-foreground">
            Usuarios, perfis, permissoes e parametros operacionais
          </p>
        </div>
        {canManage ? (
          <ActionDialog
            title="Convidar usuario"
            trigger={
              <>
                <Send className="size-4" aria-hidden="true" />
                Enviar convite
              </>
            }
            triggerClassName={`${primaryButtonClassName} sm:w-auto`}
            triggerLabel="Enviar convite"
          >
            <CreateInvitationForm roles={dashboard.roles} />
          </ActionDialog>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard label="Usuarios" value={String(dashboard.users.length)} />
        <SummaryCard
          label="Convites pendentes"
          value={String(
            invitations.filter(
              (invitation) => getAccessInvitationState(invitation) === "pending",
            ).length,
          )}
        />
        <SummaryCard label="Perfis" value={String(dashboard.roles.length)} />
        <SummaryCard label="Permissoes" value={String(dashboard.permissions.length)} />
      </div>

      <InvitationsSection
        canManage={canManage}
        invitations={invitations}
        roles={dashboard.roles}
      />
      <UsersSection
        canManage={canManage}
        employees={dashboard.employees}
        roles={dashboard.roles}
        users={dashboard.users}
      />
      <OrgUnitsSection
        canManage={canManage}
        title="Areas"
        emptyLabel="Nenhuma area cadastrada"
        items={dashboard.areas}
        createAction={createAreaAction}
        deleteAction={deleteAreaAction}
        createLabel="Adicionar area"
      />
      <OrgUnitsSection
        canManage={canManage}
        title="Cargos"
        emptyLabel="Nenhum cargo cadastrado"
        items={dashboard.positions}
        createAction={createPositionAction}
        deleteAction={deletePositionAction}
        createLabel="Adicionar cargo"
      />
      <AppSettingsSection canManage={canManage} settings={dashboard.appSettings} />
      <PermissionsSection permissions={dashboard.permissions} roles={dashboard.roles} />
    </section>
  );
}

function CreateInvitationForm({ roles }: { roles: SettingsRoleItem[] }) {
  return (
    <RateLimitedActionForm action={createAccessInvitationAction} className="grid gap-4">
      <label className={fieldClassName}>
        Email
        <input className={inputClassName} maxLength={180} name="email" required type="email" />
      </label>
      <label className={fieldClassName}>
        Validade
        <select className={inputClassName} defaultValue="7" name="expiresInDays">
          {invitationExpiryOptions.map((days) => (
            <option key={days} value={days}>
              {days} {days === 1 ? "dia" : "dias"}
            </option>
          ))}
        </select>
      </label>
      <RoleCheckboxGrid roles={roles} selected={[]} />
      <div className="flex justify-end">
        <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
          <Send className="size-4" aria-hidden="true" />
          Enviar convite
        </button>
      </div>
    </RateLimitedActionForm>
  );
}

function InvitationsSection({
  canManage,
  invitations,
  roles,
}: {
  canManage: boolean;
  invitations: AccessInvitationListItem[];
  roles: SettingsRoleItem[];
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Convites de acesso</h2>
      </div>
      {invitations.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Nenhum convite enviado.</p>
      ) : (
        <div className="divide-y">
          {invitations.map((invitation) => {
            const state = getAccessInvitationState(invitation);

            return (
              <div
                className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(16rem,1fr)_minmax(12rem,0.5fr)_auto]"
                key={invitation.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words font-medium">{invitation.email}</p>
                    <InvitationStateBadge state={state} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Expira em {formatDate(invitation.expiresAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {invitation.roleKeys.map((role) => (
                    <Badge key={role} label={roleLabels[role]} />
                  ))}
                </div>
                {canManage && state !== "used" ? (
                  <RateLimitedActionForm
                    action={createAccessInvitationAction}
                    className="flex items-start justify-end"
                  >
                    <input name="email" type="hidden" value={invitation.email} />
                    <input name="expiresInDays" type="hidden" value="7" />
                    {invitation.roleKeys.map((role) => (
                      <input key={role} name="roleKeys" type="hidden" value={role} />
                    ))}
                    <button
                      className={secondaryButtonClassName}
                      title="Renova a validade por 7 dias"
                      type="submit"
                    >
                      <RefreshCw className="size-4" aria-hidden="true" />
                      Reenviar
                    </button>
                  </RateLimitedActionForm>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {roles.length === 0 ? (
        <p className="border-t p-4 text-sm text-destructive">
          Cadastre ao menos um perfil antes de enviar convites.
        </p>
      ) : null}
    </section>
  );
}

function InvitationStateBadge({ state }: { state: AccessInvitationState }) {
  const labels: Record<AccessInvitationState, string> = {
    expired: "Expirado",
    pending: "Pendente",
    used: "Utilizado",
  };
  const className =
    state === "pending"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-muted bg-muted text-muted-foreground";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {labels[state]}
    </span>
  );
}

function UsersSection({
  canManage,
  employees,
  roles,
  users,
}: {
  canManage: boolean;
  employees: SettingsEmployeeOption[];
  roles: SettingsRoleItem[];
  users: SettingsUserListItem[];
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Usuarios</h2>
      </div>
      <div className="divide-y">
        {users.map((user) => (
          <UserManagementRow
            canManage={canManage}
            employees={employees}
            key={user.id}
            roles={roles}
            user={user}
          />
        ))}
      </div>
    </section>
  );
}

function UserManagementRow({
  canManage,
  employees,
  roles,
  user,
}: {
  canManage: boolean;
  employees: SettingsEmployeeOption[];
  roles: SettingsRoleItem[];
  user: SettingsUserListItem;
}) {
  return (
    <div className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(14rem,0.45fr)_minmax(20rem,1fr)_minmax(14rem,0.45fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{user.name}</p>
          <StatusBadge status={user.accessStatus} />
        </div>
        <p className="break-words text-sm text-muted-foreground">{user.email}</p>
        <p className="text-xs text-muted-foreground">
          {user.employeeName ?? "Sem colaborador vinculado"} - atualizado {formatDate(user.updatedAt)}
        </p>
      </div>

      {canManage ? (
        <RateLimitedActionForm
          action={updateSettingsUserRolesAction}
          className="grid gap-3"
        >
          <input name="userId" type="hidden" value={user.id} />
          <RoleCheckboxGrid roles={roles} selected={user.roles} />
          <div className="flex justify-end">
            <button className={`${secondaryButtonClassName} sm:w-auto`} type="submit">
              <Save className="size-4" aria-hidden="true" />
              Salvar perfis
            </button>
          </div>
        </RateLimitedActionForm>
      ) : (
        <div className="flex flex-wrap gap-2">
          {user.roles.map((role) => (
            <Badge key={role} label={roleLabels[role]} />
          ))}
        </div>
      )}

      {canManage ? (
        <RateLimitedActionForm
          action={updateSettingsUserEmployeeLinkAction}
          className="grid min-w-56 gap-2"
        >
          <input name="userId" type="hidden" value={user.id} />
          <label className={fieldClassName}>
            Colaborador vinculado
            <select
              className={inputClassName}
              defaultValue={user.employeeId ?? ""}
              name="employeeId"
            >
              <option value="">Sem vínculo</option>
              {employees
                .filter(
                  (employee) =>
                    !employee.linkedUserId || employee.linkedUserId === user.id,
                )
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} ({employee.registrationNumber})
                  </option>
                ))}
            </select>
          </label>
          <button className={secondaryButtonClassName} type="submit">
            <Link2 className="size-4" aria-hidden="true" />
            Salvar vínculo
          </button>
        </RateLimitedActionForm>
      ) : null}

      {canManage ? (
        <RateLimitedActionForm
          action={updateSettingsUserStatusAction}
          className="grid min-w-48 gap-2"
        >
          <input name="userId" type="hidden" value={user.id} />
          <label className={fieldClassName}>
            Status de acesso
            <select
              className={inputClassName}
              defaultValue={user.accessStatus}
              name="accessStatus"
            >
              {Object.entries(userAccessStatusLabels).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className={secondaryButtonClassName} type="submit">
            <Save className="size-4" aria-hidden="true" />
            Salvar status
          </button>
        </RateLimitedActionForm>
      ) : null}
    </div>
  );
}

function OrgUnitsSection({
  canManage,
  createAction,
  createLabel,
  deleteAction,
  emptyLabel,
  items,
  title,
}: {
  canManage: boolean;
  createAction: (formData: FormData) => void;
  createLabel: string;
  deleteAction: (formData: FormData) => void;
  emptyLabel: string;
  items: SettingsOrgUnitItem[];
  title: string;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {canManage ? (
          <ActionDialog
            title={createLabel}
            trigger={
              <>
                <Plus className="size-4" aria-hidden="true" />
                {createLabel}
              </>
            }
            triggerClassName={secondaryButtonClassName}
            triggerLabel={createLabel}
          >
            <form action={createAction} className="grid gap-3">
              <label className={fieldClassName}>
                Nome
                <input className={inputClassName} maxLength={120} name="name" required />
              </label>
              <div className="flex justify-end">
                <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
                  <Plus className="size-4" aria-hidden="true" />
                  {createLabel}
                </button>
              </div>
            </form>
          </ActionDialog>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="divide-y">
          {items.map((item) => (
            <div
              className="flex items-center justify-between gap-3 px-4 py-3"
              key={item.id}
            >
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.employeeCount} colaborador
                  {item.employeeCount === 1 ? "" : "es"}
                </p>
              </div>
              {canManage ? (
                <form action={deleteAction}>
                  <input name="id" type="hidden" value={item.id} />
                  <IconSubmitButton
                    icon={Trash2}
                    label={`Remover ${item.name}`}
                    tone="destructive"
                  />
                </form>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AppSettingsSection({
  canManage,
  settings,
}: {
  canManage: boolean;
  settings: AppSettingListItem[];
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Parametros</h2>
      </div>
      <div className="divide-y">
        {settings.map((setting) => (
          <div className="grid gap-3 p-4 xl:grid-cols-[minmax(14rem,0.4fr)_1fr]" key={setting.id}>
            <div>
              <p className="font-medium">{settingLabels[setting.key] ?? setting.key}</p>
              <p className="text-sm text-muted-foreground">{setting.description ?? "-"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Atualizado por {setting.updatedByName ?? "Sistema"} em {formatDate(setting.updatedAt)}
              </p>
            </div>
            {canManage ? (
              <form action={updateAppSettingAction} className="grid gap-3">
                <input name="key" type="hidden" value={setting.key} />
                <label className={fieldClassName}>
                  Valor
                  <textarea
                    className={textareaClassName}
                    defaultValue={stringifySettingValue(setting.value)}
                    name="value"
                    rows={5}
                  />
                </label>
                <label className={fieldClassName}>
                  Descricao
                  <input
                    className={inputClassName}
                    defaultValue={setting.description ?? ""}
                    maxLength={500}
                    name="description"
                  />
                </label>
                <div className="flex justify-end">
                  <button className={`${secondaryButtonClassName} sm:w-auto`} type="submit">
                    <Save className="size-4" aria-hidden="true" />
                    Salvar parametro
                  </button>
                </div>
              </form>
            ) : (
              <pre className="overflow-auto rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                {stringifySettingValue(setting.value)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function PermissionsSection({
  permissions,
  roles,
}: {
  permissions: SettingsPermissionItem[];
  roles: SettingsRoleItem[];
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Matriz de permissoes</h2>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        {roles.map((role) => (
          <div className="rounded-md border p-4" key={role.key}>
            <p className="font-medium">{role.name}</p>
            <p className="text-sm text-muted-foreground">{role.description ?? roleLabels[role.key]}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {permissions
                .filter((permission) => role.permissions.includes(permission.key))
                .map((permission) => (
                  <span
                    className="rounded-md border bg-muted px-2 py-1 text-xs text-muted-foreground"
                    key={permission.key}
                    title={permission.description}
                  >
                    {permission.key}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RoleCheckboxGrid({
  roles,
  selected,
}: {
  roles: SettingsRoleItem[];
  selected: RoleKey[];
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">Perfis</legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm" key={role.key}>
            <input
              className="size-4 accent-primary"
              defaultChecked={selected.includes(role.key)}
              name="roleKeys"
              type="checkbox"
              value={role.key}
            />
            <span>{role.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
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

function StatusBadge({
  status,
}: {
  status: SettingsUserListItem["accessStatus"];
}) {
  const className =
    status === "active"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "pending"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
        : "border-destructive/30 bg-destructive/10 text-destructive";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {userAccessStatusLabels[status]}
    </span>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-md border bg-muted px-2 py-1 text-xs text-muted-foreground">
      {label}
    </span>
  );
}

function IconSubmitButton({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof Trash2;
  label: string;
  tone: "destructive" | "primary";
}) {
  const className =
    tone === "primary"
      ? "border-primary/30 text-primary hover:bg-primary/10"
      : "border-destructive/30 text-destructive hover:bg-destructive/10";

  return (
    <button
      aria-label={label}
      className={`inline-flex size-8 items-center justify-center rounded-md border transition-colors ${className}`}
      title={label}
      type="submit"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const textareaClassName =
  "min-h-24 w-full min-w-0 resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const userAccessStatusLabels: Record<
  SettingsUserListItem["accessStatus"],
  string
> = {
  active: "Ativo",
  pending: "Pendente",
  revoked: "Revogado",
  suspended: "Suspenso",
};

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

const secondaryButtonClassName =
  "inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
