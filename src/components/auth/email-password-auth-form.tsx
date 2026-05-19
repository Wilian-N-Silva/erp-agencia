"use client";

import { KeyRound, UserPlus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { authClient } from "@/lib/auth/client";
import { DEFAULT_AUTH_CALLBACK_URL } from "@/lib/auth/config";

type Mode = "sign-in" | "sign-up";

function getCallbackUrl() {
  if (typeof window === "undefined") {
    return DEFAULT_AUTH_CALLBACK_URL;
  }

  return (
    new URLSearchParams(window.location.search).get("callbackURL") ??
    DEFAULT_AUTH_CALLBACK_URL
  );
}

export function EmailPasswordAuthForm({
  signUpEnabled,
}: {
  signUpEnabled: boolean;
}) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const callbackURL = useMemo(getCallbackUrl, []);
  const isSignUp = mode === "sign-up";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    try {
      const result = isSignUp
        ? await authClient.signUp.email({
            callbackURL,
            email,
            name,
            password,
          })
        : await authClient.signIn.email({
            callbackURL,
            email,
            password,
            rememberMe: true,
          });

      if (result.error) {
        setErrorMessage(result.error.message ?? "Nao foi possivel autenticar.");
        return;
      }

      window.location.assign(callbackURL);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {signUpEnabled ? (
        <div className="grid grid-cols-2 rounded-lg border bg-muted p-1">
          <button
            className={modeButtonClassName(!isSignUp)}
            onClick={() => setMode("sign-in")}
            type="button"
          >
            Entrar
          </button>
          <button
            className={modeButtonClassName(isSignUp)}
            onClick={() => setMode("sign-up")}
            type="button"
          >
            Criar acesso
          </button>
        </div>
      ) : null}

      {isSignUp ? (
        <label className="flex flex-col gap-2 text-sm font-medium">
          Nome
          <input
            autoComplete="name"
            className="h-11 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            name="name"
            required
            type="text"
          />
        </label>
      ) : null}

      <label className="flex flex-col gap-2 text-sm font-medium">
        Email
        <input
          autoComplete="email"
          className="h-11 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          name="email"
          required
          type="email"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium">
        Senha
        <input
          autoComplete={isSignUp ? "new-password" : "current-password"}
          className="h-11 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>

      {errorMessage ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isSignUp ? (
          <UserPlus aria-hidden="true" className="size-4" />
        ) : (
          <KeyRound aria-hidden="true" className="size-4" />
        )}
        {isPending ? "Enviando..." : isSignUp ? "Criar acesso" : "Entrar"}
      </button>
    </form>
  );
}

function modeButtonClassName(isActive: boolean) {
  return [
    "h-9 rounded-md px-3 text-sm font-medium transition-colors",
    isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
  ].join(" ");
}
