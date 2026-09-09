import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LoginError, LoginSubmit, PremiumLoginShell } from "@/components/login/premium-login-shell";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isPending && user) {
    return <Navigate to="/" />;
  }

  const scrollToForm = () => {
    document.getElementById("login-sign-in")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const storeCta = (
    <>
      <a
        href="#login-sign-in"
        className="login-cta-primary"
        onClick={(e) => {
          e.preventDefault();
          scrollToForm();
        }}
      >
        Sign in
      </a>
      <a
        href="#login-sign-in"
        className="login-cta-secondary"
        onClick={(e) => {
          e.preventDefault();
          scrollToForm();
        }}
      >
        Continue
      </a>
    </>
  );

  const onProvider = async (providerId: string) => {
    setError(null);
    setBusy(providerId);
    try {
      await signIn(providerId, { callbackURL: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(null);
    }
  };

  return (
    <PremiumLoginShell
      productName="Zyvor Agora"
      productWordmark="agora"
      heroTitle="Ops chat for the cutover."
      heroSubheadline="War rooms, threads, and huddles on-estate — Mattermost is the tape, this is the product."
      pills={[
        { label: "War rooms", tone: "sky" },
        { label: "Threads", tone: "violet" },
        { label: "Huddles", tone: "emerald" },
        { label: "Cutover", tone: "amber" },
      ]}
      heroCta={storeCta}
      chapterNote="Zyvor Agora · sign in to open the desktop"
      panelSubtitle="Sign in"
      panelHint={
        authEnabled ? (
          <>
            Continue with Google or X. Lab deploy:{" "}
            <span className="font-mono">./scripts/deploy-remote.sh</span> after sign-in works locally.
          </>
        ) : (
          <>Sign-in is disabled in this build. Remove <span className="font-mono">VITE_AUTH_ENABLED</span> from app-env.</>
        )
      }
      showSignInChapter
    >
      <div className="login-step space-y-3 text-left" aria-label="Sign in methods">
        {error ? <LoginError message={error} /> : null}

        {authEnabled ? (
          GROK_PROVIDERS.map((p) => (
            <LoginSubmit
              key={p.providerId}
              type="button"
              loading={busy === p.providerId}
              disabled={busy !== null}
              onClick={() => void onProvider(p.providerId)}
            >
              {busy === p.providerId ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Opening {p.label}…</span>
                </>
              ) : (
                <>
                  <span>Continue with {p.label}</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </LoginSubmit>
          ))
        ) : (
          <p className="text-sm text-zinc-500">Sign-in is disabled.</p>
        )}
      </div>
    </PremiumLoginShell>
  );
}
