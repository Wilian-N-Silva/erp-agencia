const summaryItems = [
  { label: "Pendencias", value: "0" },
  { label: "Alertas", value: "0" },
  { label: "Aprovacoes", value: "0" },
  { label: "Vencimentos", value: "0" },
];

export default function AppHomePage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visao operacional</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryItems.map((item) => (
          <div className="rounded-lg border bg-card p-4" key={item.label}>
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">Fila principal</h2>
          <div className="mt-4 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            Sem itens pendentes
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">Eventos proximos</h2>
          <div className="mt-4 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            Sem eventos proximos
          </div>
        </section>
      </div>
    </section>
  );
}
