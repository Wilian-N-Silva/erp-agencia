"use client";

import { LogIn } from "lucide-react";
import { useMemo, useState } from "react";

import { authClient } from "@/lib/auth/client";
import { DEFAULT_AUTH_CALLBACK_URL } from "@/lib/auth/config";

function getCallbackUrl() {
  if (typeof window === "undefined") {
    return DEFAULT_AUTH_CALLBACK_URL;
  }

  return (
    new URLSearchParams(window.location.search).get("callbackURL") ??
    DEFAULT_AUTH_CALLBACK_URL
  );
}

export function GoogleSignInButton() {
  const [isPending, setIsPending] = useState(false);
  const callbackURL = useMemo(getCallbackUrl, []);

  async function handleSignIn() {
    setIsPending(true);

    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isPending}
      onClick={handleSignIn}
      type="button"
    >
      <LogIn aria-hidden="true" className="size-4" />
      {isPending ? "Abrindo..." : "Entrar com Google"}
    </button>
  );
}
