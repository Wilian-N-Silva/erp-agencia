import { KeyRound, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";

import { Card, EmptyState, StatusBadge } from "@/components/fg";
import { listAccessRecords, type AccessRecordListItem } from "@/features/accesses/dal";
import { accessRecordStatusLabels, type AccessRecordStatus } from "@/features/accesses/rules";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function PortalAccessesPage() {
  const context = await getCurrentAccessContext();
  if (!context) {
    redirect("/login");
  }

  const records = await listAccessRecords(context, {}, { ownOnly: true });

  return (
    <>
      <h1 className="fg-portal-h1">Meus acessos</h1>

      {records.length === 0 ? (
        <Card>
          <EmptyState
            icon={<KeyRound size={32} />}
            title="Nenhum acesso registrado"
            description="Quando o TI registrar um acesso para você, ele aparece aqui."
          />
        </Card>
      ) : (
        <div className="fg-portal-acessos-grid">
          {records.map((record) => (
            <AccessCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </>
  );
}

function AccessCard({ record }: { record: AccessRecordListItem }) {
  return (
    <div className="fg-portal-acesso-card">
      <div className="fg-portal-item-icon">
        {record.critical ? <ShieldAlert size={18} /> : <KeyRound size={18} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="fg-portal-acesso-name">{record.platform}</div>
        <div className="fg-portal-acesso-cat">
          {record.accountIdentifier ?? "—"} · {record.accessLevel}
        </div>
      </div>
      <StatusBadge
        tone={record.status === "active" ? "success" : record.status === "removed" ? "muted" : "warning"}
        label={accessRecordStatusLabels[record.status as AccessRecordStatus] ?? record.status}
        withDot={false}
      />
    </div>
  );
}
