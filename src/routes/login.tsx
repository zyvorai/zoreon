import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { authClient, GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { emailAndPasswordEnabled } from "@/lib/auth/email-password";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  LoginDivider,
  LoginError,
  LoginField,
  LoginSubmit,
  PremiumLoginShell,
} from "@/components/login/premium-login-shell";
import { ZyvorMark } from "@/components/brand/zyvor-mark";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const onEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) return;
    setError(null);
    setBusy("email");
    try {
      const res = await authClient.signIn.email({
        email: trimmed,
        password,
      });
      if (res.error) throw new Error(res.error.message || "Invalid email or password");
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(null);
    }
  };

  const emailReady = emailAndPasswordEnabled && authEnabled;

  return (
    <PremiumLoginShell
      logo={<ZyvorMark size={56} alt="Zyvor" />}
      productName="Zoreon"
      productWordmark="Zoreon"
      heroTitle="Ops chat for the cutover."
      heroSubheadline="War rooms, threads, and huddles on-estate — Mattermost is the tape, this is the product."
      pills={[
        { label: "War rooms", tone: "sky" },
        { label: "Threads", tone: "violet" },
        { label: "Huddles", tone: "emerald" },
        { label: "Cutover", tone: "amber" },
      ]}
      heroCta={storeCta}
      chapterNote="Zoreon · sign in to open the desktop"
      panelSubtitle="Sign in"
      panelHint={
        emailReady ? (
          <>
            Use your work email (e.g. <span className="font-mono">you@zyvor.dev</span>) or continue with
            Google / X SSO. New accounts need an invite link.
          </>
        ) : authEnabled ? (
          <>Continue with Google or X.</>
        ) : (
          <>Sign-in is disabled in this build.</>
        )
      }
      showSignInChapter
    >
      <div className="login-step text-left" aria-label="Sign in methods">
        {error ? <LoginError message={error} /> : null}

        {emailReady ? (
          <>
            <form onSubmit={(e) => void onEmailSubmit(e)} autoComplete="on" className="space-y-0">
              <LoginField label="Email" id="email">
                <Mail className="login-field-icon" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="login-input"
                  placeholder="you@zyvor.dev"
                  autoComplete="email"
                  autoFocus
                  required
                  disabled={busy !== null}
                />
              </LoginField>

              <LoginField label="Password" id="password">
                <Lock className="login-field-icon" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input pr-11"
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  disabled={busy !== null}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3.5 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </LoginField>

              <LoginSubmit loading={busy === "email"} disabled={!email.trim() || password.length < 8 || busy !== null}>
                {busy === "email" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign in with email</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </LoginSubmit>
            </form>

            <p className="mt-3 text-xs text-zinc-500">
              Need an account? Ask an admin for an invite link (
              <span className="font-mono">/join?token=…</span>).
            </p>

            <LoginDivider label="or SSO" />
          </>
        ) : null}

        {authEnabled ? (
          <div className="space-y-3">
            {GROK_PROVIDERS.map((p) => (
              <LoginSubmit
                key={p.providerId}
                type="button"
                variant={emailReady ? "secondary" : "primary"}
                className="!mt-0"
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
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Sign-in is disabled.</p>
        )}
      </div>
    </PremiumLoginShell>
  );
}
