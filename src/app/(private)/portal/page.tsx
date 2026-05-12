export default function PortalPage() {
  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">Portal</h1>
        <p className="text-sm text-muted-foreground">Dados e solicitacoes</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {["Dados", "NFs", "Reembolsos", "Ferias", "Documentos", "Acessos"].map(
          (item) => (
            <div className="rounded-lg border bg-card p-4" key={item}>
              <p className="text-sm font-medium">{item}</p>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
