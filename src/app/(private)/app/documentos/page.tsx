import { Ban, Download, FileUp } from "lucide-react";
import { redirect } from "next/navigation";

import { deleteDocumentAction, registerDocumentAction } from "@/features/documents/actions";
import { ActionDialog } from "@/components/ui/action-dialog";
import {
  listDocumentEmployeeOptions,
  listDocuments,
  type DocumentListItem,
  type DocumentOwnerOption,
} from "@/features/documents/dal";
import {
  canWriteDocuments,
  documentTypeLabels,
  documentVisibilityLabels,
  fileSensitivityLabels,
} from "@/features/documents/rules";
import { formatDate } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canAny(["documents.write", "documents.read_sensitive"], context)) {
    redirect("/acesso-negado");
  }

  const canWrite = canWriteDocuments(context);
  const [documents, employeeOptions] = await Promise.all([
    listDocuments(context),
    canWrite ? listDocumentEmployeeOptions(context) : Promise.resolve([]),
  ]);

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-normal">Documentos</h1>
          <p className="text-sm text-muted-foreground">Metadados, sensibilidade e visibilidade</p>
        </div>
        {canWrite ? (
          <ActionDialog
            title="Enviar documento"
            trigger={
              <>
                <FileUp className="size-4" aria-hidden="true" />
                Enviar documento
              </>
            }
            triggerClassName={`${primaryButtonClassName} sm:w-auto`}
            triggerLabel="Enviar documento"
          >
            <DocumentRegistrationForm employeeOptions={employeeOptions} />
          </ActionDialog>
        ) : null}
      </div>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Documentos registrados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Arquivo</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Colaborador</th>
                <th className="px-4 py-3 font-medium">Sensibilidade</th>
                <th className="px-4 py-3 font-medium">Versao</th>
                <th className="px-4 py-3 font-medium">Criado em</th>
                <th className="px-4 py-3 text-right font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                    Nenhum documento registrado.
                  </td>
                </tr>
              ) : (
                documents.map((document) => (
                  <DocumentRow canWrite={canWrite} document={document} key={document.id} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function DocumentRegistrationForm({
  employeeOptions,
}: {
  employeeOptions: DocumentOwnerOption[];
}) {
  return (
    <form action={registerDocumentAction} className="grid gap-4" encType="multipart/form-data">
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
    </form>
  );
}

function DocumentRow({ canWrite, document }: { canWrite: boolean; document: DocumentListItem }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3">
        <p className="font-medium">{document.originalName}</p>
        <p className="text-xs text-muted-foreground">{document.storageKey}</p>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {documentTypeLabels[document.documentType as keyof typeof documentTypeLabels] ?? document.documentType}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{document.ownerEmployeeName ?? "-"}</td>
      <td className="px-4 py-3 text-muted-foreground">{fileSensitivityLabels[document.sensitivity]}</td>
      <td className="px-4 py-3 text-muted-foreground">v{document.version}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(document.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <a
            aria-label="Baixar documento"
            className="inline-flex size-8 items-center justify-center rounded-md border border-primary/30 text-primary transition-colors hover:bg-primary/10"
            href={`/app/documentos/${document.id}/download`}
            title="Baixar documento"
          >
            <Download className="size-4" aria-hidden="true" />
          </a>
          {canWrite ? (
          <form action={deleteDocumentAction}>
            <input name="id" type="hidden" value={document.id} />
            <button
              aria-label="Excluir documento"
              className="inline-flex size-8 items-center justify-center rounded-md border border-destructive/30 text-destructive transition-colors hover:bg-destructive/10"
              title="Excluir documento"
              type="submit"
            >
              <Ban className="size-4" aria-hidden="true" />
            </button>
          </form>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fileInputClassName =
  "min-h-10 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";
