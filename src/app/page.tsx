const foundationItems = [
  "Auth",
  "RBAC",
  "DAL",
  "Audit logs",
  "Banco e migrations",
  "Layout privado",
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-primary">Sistema Interno FG</p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-normal text-foreground">
            Fundacao tecnica em andamento
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Esta branch prepara a base do produto antes dos modulos privados,
            permissoes e fluxos operacionais.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {foundationItems.map((item) => (
            <div
              className="rounded-lg border bg-card px-4 py-3 text-sm font-medium text-card-foreground"
              key={item}
            >
              {item}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
