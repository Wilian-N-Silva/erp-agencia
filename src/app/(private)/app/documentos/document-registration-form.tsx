import { FileUp } from "lucide-react";

import { RateLimitedActionForm } from "@/components/fg";
import { registerDocumentAction } from "@/features/documents/actions";
import type { DocumentOwnerOption } from "@/features/documents/dal";
import {
  documentTypeLabels,
  documentVisibilityLabels,
  fileSensitivityLabels,
} from "@/features/documents/rules";

export function DocumentRegistrationForm({
  employeeOptions,
}: {
  employeeOptions: DocumentOwnerOption[];
}) {
  return (
    <RateLimitedActionForm
      action={registerDocumentAction}
      className="grid gap-4"
    >
      <input name="ownerType" type="hidden" value="employee" />
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Colaborador
          <select className={inputClassName} name="ownerId" required>
            <option value="">Selecione um colaborador</option>
            {employeeOptions.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Tipo
          <select className={inputClassName} name="documentType" required>
            {Object.entries(documentTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={fieldClassName}>
        Arquivo
        <input
          accept=".pdf,.jpg,.jpeg,.png,.xml,.xlsx,application/pdf,image/jpeg,image/png,application/xml,text/xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className={fileInputClassName}
          name="file"
          required
          type="file"
        />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Sensibilidade
          <select className={inputClassName} defaultValue="restricted" name="sensitivity">
            {Object.entries(fileSensitivityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Visibilidade
          <select className={inputClassName} defaultValue="restricted" name="visibility">
            {Object.entries(documentVisibilityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex justify-end">
        <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
          <FileUp className="size-4" aria-hidden="true" />
          Enviar documento
        </button>
      </div>
    </RateLimitedActionForm>
  );
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fileInputClassName =
  "min-h-10 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";
