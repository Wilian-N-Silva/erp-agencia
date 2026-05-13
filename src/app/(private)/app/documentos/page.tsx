import { Ban, FileUp } from "lucide-react";
import { redirect } from "next/navigation";

import { deleteDocumentAction, registerDocumentAction } from "@/features/documents/actions";
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
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">Documentos</h1>
        <p className="text-sm text-muted-foreground">Metadados, sensibilidade e visibilidade</p>
      </div>

      {canWrite ? <DocumentRegistrationForm employeeOptions={employeeOptions} /> : null}

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
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Registrar documento</h2>
      </div>
      <form action={registerDocumentAction} className="grid gap-4 p-4">
        <input name="ownerType" type="hidden" value="employee" />
        <div className="grid gap-3 lg:grid-cols-3">
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
          <label className={fieldClassName}>
            Nome do arquivo
            <input className={inputClassName} maxLength={240} name="originalName" required />
          </label>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <label className={fieldClassName}>
            MIME type
            <input
              className={inputClassName}
              defaultValue="application/pdf"
              maxLength={160}
              name="mimeType"
              required
            />
          </label>
          <label className={fieldClassName}>
            Tamanho bytes
            <input className={inputClassName} min={1} name="byteSize" required type="number" />
          </label>
          <label className={fieldClassName}>
            Storage key
            <input className={inputClassName} maxLength={500} name="storageKey" required />
          </label>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
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
          <label className={fieldClassName}>
            Checksum
            <input className={inputClassName} maxLength={160} name="checksum" />
          </label>
        </div>
        <div className="flex justify-end">
          <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
            <FileUp className="size-4" aria-hidden="true" />
            Registrar documento
          </button>
        </div>
      </form>
    </section>
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
        {canWrite ? (
          <form action={deleteDocumentAction} className="flex justify-end">
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
      </td>
    </tr>
  );
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";
