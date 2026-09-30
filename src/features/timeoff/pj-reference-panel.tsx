import { Card } from "@/components/fg";
import { formatDate } from "@/features/finance/rules";
import type { listPjTenureReferences } from "./pj-reference-dal";
import { formatPjTenure } from "./pj-reference-rules";

export function PjReferencePanel({ references }: { references: Awaited<ReturnType<typeof listPjTenureReferences>> }) {
  if (!references.length) return null;
  return (
    <Card title="Tempo de vínculo e referência de férias — PJ"
      description={`Atualizado em ${formatDate(references[0].today)}. Referência a cada 12 meses desde o início. O descanso pode ser combinado para outra data e depende de aprovação.`}>
      <div className="fg-table-wrap">
        <table className="fg-table fg-table-regular" aria-label="Referências anuais dos PJs">
          <thead><tr><th>Colaborador</th><th>Início do vínculo</th><th>Tempo de vínculo</th><th>Última referência</th><th>Próxima referência</th></tr></thead>
          <tbody>{references.map(item => (
            <tr key={item.id}>
              <td>{item.name}</td><td>{formatDate(item.startDate)}</td>
              <td>{item.ended && !item.endDate ? "Vínculo encerrado — informe a data de término" : <>{formatPjTenure(item)}{item.ended ? ` · encerrado em ${formatDate(item.endDate)}` : ""}</>}</td>
              <td>{item.ended && !item.endDate ? "Data de término não informada" : item.lastReference ? formatDate(item.lastReference) : "Primeiro ciclo ainda não completado"}</td>
              <td>{item.nextReference ? formatDate(item.nextReference) : "Vínculo encerrado"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="fg-muted">Estas datas não indicam saldo disponível, férias tiradas ou prazo obrigatório para descanso. Consulte as solicitações aprovadas abaixo.</p>
    </Card>
  );
}
