import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center px-6 py-8">
      <section className="mx-auto flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-primary">Sistema Interno FG</p>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            Acesso interno
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Use a conta Google autorizada para acessar o sistema.
          </p>
        </div>

        <GoogleSignInButton />
      </section>
    </main>
  );
}
