import { Card } from "@/components/fg";
import { getCurrentPortalEmployeeAccess } from "@/features/portal/access";
import { PortalEmployeeLinkRequired } from "@/features/portal/employee-link-required";
import { employmentTypeLabels, type EmploymentType } from "@/features/people/rules";

export const dynamic = "force-dynamic";

export default async function PortalDataPage() {
  const access = await getCurrentPortalEmployeeAccess();
  if (!access) {
    return <PortalEmployeeLinkRequired />;
  }

  const { employee } = access;

  return (
    <>
      <h1 className="fg-portal-h1">Meus dados</h1>

      <Card title="Identificação">
        <dl className="fg-deflist">
          <div>
            <dt>Nome completo</dt>
            <dd>{employee.fullName}</dd>
          </div>
          <div>
            <dt>Matrícula</dt>
            <dd className="fg-tabular">{employee.registrationNumber}</dd>
          </div>
          <div>
            <dt>Cargo</dt>
            <dd>{employee.positionName}</dd>
          </div>
          <div>
            <dt>Área</dt>
            <dd>{employee.areaName}</dd>
          </div>
          <div>
            <dt>Vínculo</dt>
            <dd>
              {employmentTypeLabels[employee.employmentType as EmploymentType] ??
                employee.employmentType}
            </dd>
          </div>
        </dl>
      </Card>

      <Card
        title="Atualizar dados pessoais"
        description="Para atualizar dados pessoais (endereço, contato, plano de saúde), entre em contato com o RH."
      >
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-700)" }}>
          Esta seção é apenas leitura no portal. As atualizações são feitas pelo time de pessoas
          após validação dos documentos.
        </p>
      </Card>
    </>
  );
}
