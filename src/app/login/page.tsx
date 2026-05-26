import { EmailPasswordAuthForm } from "@/components/auth/email-password-auth-form";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import {
  isEmailPasswordAuthEnabled,
  isEmailPasswordSignUpEnabled,
  isGoogleAuthConfigured,
} from "@/lib/auth/config";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const googleEnabled = isGoogleAuthConfigured();
  const emailPasswordEnabled = isEmailPasswordAuthEnabled();
  const signUpEnabled = isEmailPasswordSignUpEnabled();

  return (
    <main className="flex min-h-screen items-center px-6 py-8">
      <section className="mx-auto flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-primary">Sistema Interno FG</p>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            Acesso interno
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Use uma conta autorizada para acessar o sistema.
          </p>
        </div>

        {emailPasswordEnabled ? (
          <EmailPasswordAuthForm signUpEnabled={signUpEnabled} />
        ) : null}

        {emailPasswordEnabled && googleEnabled ? (
          <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>
        ) : null}

        {googleEnabled ? <GoogleSignInButton /> : null}
      </section>
    </main>
  );
}
