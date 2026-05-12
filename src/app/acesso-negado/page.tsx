import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center px-6 py-8">
      <section className="mx-auto flex w-full max-w-md flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-primary">Sistema Interno FG</p>
          <h1 className="text-2xl font-semibold tracking-normal">Acesso negado</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Sua conta nao possui permissao para acessar este recurso.
          </p>
        </div>

        <Link
          className="inline-flex h-10 w-fit items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          href="/app"
        >
          Voltar ao sistema
        </Link>
      </section>
    </main>
  );
}
