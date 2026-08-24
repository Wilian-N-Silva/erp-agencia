import { UserRoundX } from "lucide-react";

import { Card, EmptyState, FGLogo } from "@/components/fg";

export function PortalEmployeeLinkRequired() {
  return (
    <div className="fg-portal">
      <header className="fg-portal-header">
        <div className="fg-portal-header-inner">
          <div className="fg-portal-logo" aria-label="Formula">
            <FGLogo size={22} />
          </div>
        </div>
      </header>
      <main className="fg-portal-main">
        <div className="fg-portal-container">
          <div className="fg-portal-page">
            <Card>
              <EmptyState
                icon={<UserRoundX size={24} aria-hidden="true" />}
                title="Vínculo de colaborador pendente"
                description="Sua conta está ativa, mas ainda não foi vinculada a um cadastro de colaborador. Solicite a um administrador que conclua o vínculo para liberar o portal."
              />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
