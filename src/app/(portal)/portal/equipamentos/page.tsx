import { Laptop } from "lucide-react";
import { redirect } from "next/navigation";

import { Card, EmptyState, StatusBadge } from "@/components/fg";
import { listEquipment, type EquipmentListItem } from "@/features/equipment/dal";
import { equipmentStatusLabels, type EquipmentStatus } from "@/features/equipment/rules";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function PortalEquipmentPage() {
  const context = await getCurrentAccessContext();
  if (!context) {
    redirect("/login");
  }

  const equipment = await listEquipment(context, {}, { ownOnly: true });

  return (
    <>
      <h1 className="fg-portal-h1">Meus equipamentos</h1>

      {equipment.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Laptop size={32} />}
            title="Nenhum equipamento atribuído"
            description="Quando o TI atribuir um equipamento à sua conta, ele aparece aqui."
          />
        </Card>
      ) : (
        <div className="fg-portal-eq-grid">
          {equipment.map((item) => (
            <EquipmentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}

function EquipmentCard({ item }: { item: EquipmentListItem }) {
  return (
    <article className="fg-portal-eq-card">
      <div className="fg-portal-eq-icon">
        <Laptop size={24} />
      </div>
      <div className="fg-portal-eq-title">
        {item.brand ?? "Equipamento"} {item.model ?? item.type}
      </div>
      <div className="fg-portal-eq-pat">Patrimônio {item.assetNumber}</div>
      <dl className="fg-portal-eq-dl">
        <div>
          <dt>Tipo</dt>
          <dd>{item.type}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <StatusBadge tone="muted" label={equipmentStatusLabels[item.status as EquipmentStatus] ?? item.status} withDot={false} />
          </dd>
        </div>
        {item.serialNumber ? (
          <div>
            <dt>Nº de série</dt>
            <dd className="fg-tabular">{item.serialNumber}</dd>
          </div>
        ) : null}
        {item.notes ? (
          <div>
            <dt>Observações</dt>
            <dd>{item.notes}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}
