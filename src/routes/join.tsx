import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { emailAndPasswordEnabled } from "@/lib/auth/email-password";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  LoginError,
  LoginField,
  LoginSubmit,
  PremiumLoginShell,
} from "@/components/login/premium-login-shell";
import { ZyvorMark } from "@/components/brand/zyvor-mark";
import { completeInviteSignup, validateInvite } from "@/lib/zoreon/api";

export const Route = createFileRoute("/join")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: JoinPage,
});

function JoinPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [tokenOk, setTokenOk] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token.trim()) {
      setTokenOk(false);
      return;
    }
    void validateInvite({ data: { token } })
      .then((r) => {
        if (!cancelled) setTokenOk(r.ok);
      })
      .catch(() => {
        if (!cancelled) setTokenOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!isPending && user) {
    return <Navigate to="/" />;
  }

  const emailReady = emailAndPasswordEnabled && authEnabled;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password || !token.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const res = await authClient.signUp.email({
        email: trimmed,
        password,
        name: name.trim() || trimmed.split("@")[0] || "User",
      });
      if (res.error) throw new Error(res.error.message || "Could not create account");
      try {
        await completeInviteSignup({
          data: {
            token,
            email: trimmed,
            name: name.trim() || undefined,
            password,
          },
        });
      } catch {
        /* Zoreon account exists; MM team add is best-effort */
      }
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PremiumLoginShell
      logo={<ZyvorMark size={56} alt="Zyvor" />}
      productName="Zoreon"
      productWordmark="Zoreon"
      heroTitle="Join the workspace."
      heroSubheadline="Use your invite link to create an Zoreon account for this estate."
      pills={[
        { label: "Invite", tone: "sky" },
        { label: "Ops chat", tone: "violet" },
        { label: "Cutover", tone: "amber" },
      ]}
      chapterNote="Zoreon · workspace invite"
      panelSubtitle="Create account"
      panelHint={
        tokenOk === false ? (
          <>This invite is invalid or was regenerated. Ask an admin for a new link.</>
        ) : (
          <>You need a valid invite token to create an account.</>
        )
      }
      showSignInChapter
    >
      <div className="login-step text-left" aria-label="Join workspace">
        {error ? <LoginError message={error} /> : null}

        {tokenOk === null ? (
          <p className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" />
            Checking invite…
          </p>
        ) : null}

        {tokenOk === false ? (
          <p className="text-sm text-zinc-600">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-zinc-900 underline-offset-2 hover:underline">
              Sign in
            </Link>
          </p>
        ) : null}

        {tokenOk && emailReady ? (
          <form onSubmit={(e) => void onSubmit(e)} autoComplete="on" className="space-y-0">
            <LoginField label="Name" id="join-name">
              <input
                id="join-name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="login-input !pl-3"
                placeholder="S Sahani"
                autoComplete="name"
                disabled={busy}
              />
            </LoginField>

            <LoginField label="Email" id="join-email">
              <Mail className="login-field-icon" />
              <input
                id="join-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
                placeholder="you@zyvor.dev"
                autoComplete="email"
                autoFocus
                required
                disabled={busy}
              />
            </LoginField>

            <LoginField label="Password" id="join-password">
              <Lock className="login-field-icon" />
              <input
                id="join-password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input pr-11"
                placeholder="Password"
                autoComplete="new-password"
                required
                minLength={8}
                disabled={busy}
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

            <LoginSubmit loading={busy} disabled={!email.trim() || password.length < 8 || busy}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Creating…</span>
                </>
              ) : (
                <>
                  <span>Join workspace</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </LoginSubmit>
          </form>
        ) : null}

        {tokenOk && !emailReady ? (
          <p className="text-sm text-zinc-500">Email signup is disabled in this build.</p>
        ) : null}

        {tokenOk ? (
          <p className="mt-4 text-sm text-zinc-500">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-zinc-900 underline-offset-2 hover:underline">
              Sign in
            </Link>
          </p>
        ) : null}
      </div>
    </PremiumLoginShell>
  );
}
