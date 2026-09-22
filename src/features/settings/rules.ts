import type { AccessContext } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";
import { roleKeys, type RoleKey } from "@/lib/rbac";

export const settingLabels: Record<string, string> = {
  allowed_email_domain: "Dominio permitido",
  storage: "Armazenamento",
  upload_max_bytes: "Limite de upload",
};

export const lastSettingsAdministratorError =
  "At least one active settings administrator is required.";

export function assertRoleReplacementKeepsSettingsAdministrator(input: {
  activeSettingsAdministratorCount: number;
  replacementHasSettingsManage: boolean;
  targetHasSettingsManage: boolean;
  targetIsActive: boolean;
}) {
  if (
    input.targetIsActive &&
    input.targetHasSettingsManage &&
    !input.replacementHasSettingsManage &&
    input.activeSettingsAdministratorCount <= 1
  ) {
    throw new Error(lastSettingsAdministratorError);
  }
}

export type SettingJson =
  | null
  | string
  | number
  | boolean
  | SettingJson[]
  | { [key: string]: SettingJson };

export function canReadSettings(context: AccessContext) {
  return canAny(["settings.read", "settings.manage"], context);
}

export function canManageSettings(context: AccessContext) {
  return can("settings.manage", context);
}

export function isRoleSelection(value: string): value is RoleKey {
  return (roleKeys as readonly string[]).includes(value);
}

export function normalizeRoleSelection(values: readonly string[]) {
  return [...new Set(values.filter(isRoleSelection))].sort();
}

export function parseSettingValue(input: string): SettingJson {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return normalizeJsonValue(JSON.parse(trimmed));
  } catch {
    return trimmed;
  }
}

export function stringifySettingValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function normalizeJsonValue(value: unknown): SettingJson {
  if (value === null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        normalizeJsonValue(entryValue),
      ]),
    );
  }

  return String(value);
}
