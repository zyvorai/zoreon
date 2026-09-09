/**
 * Sign-in shell — full-bleed hero (brand → title → lede → CTAs),
 * second section for credentials.
 */
import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import "@/styles/zyvor-premium-login.css";

export type PremiumLoginTone = "sky" | "violet" | "emerald" | "amber";

export type PremiumLoginPill = {
  icon?: ReactNode;
  label: string;
  tone?: PremiumLoginTone;
};

export type PremiumLoginShellProps = {
  logo?: ReactNode;
  productName: string;
  productWordmark?: string;
  productSubtitle?: string;
  heroTitle?: ReactNode;
  heroSubheadline?: ReactNode;
  heroCta?: ReactNode;
  accent?: PremiumLoginTone;
  chapterNote?: ReactNode;
  pills?: PremiumLoginPill[];
  panelTitle?: string;
  panelSubtitle?: ReactNode;
  panelHint?: ReactNode;
  footer?: ReactNode;
  formClassName?: string;
  showSignInChapter?: boolean;
  children?: ReactNode;
};

export function PremiumLoginShell({
  logo,
  productName,
  productWordmark,
  productSubtitle,
  heroTitle = "Ops chat for the cutover.",
  heroSubheadline,
  heroCta,
  accent = "sky",
  chapterNote = "Zoreon · sign in to continue",
  pills,
  panelTitle,
  panelSubtitle,
  panelHint,
  footer,
  formClassName = "",
  showSignInChapter = true,
  children,
}: PremiumLoginShellProps) {
  const tagline =
    heroSubheadline ?? productSubtitle ?? "War rooms, threads, and huddles — scroll to sign in.";
  const formHeading =
    panelSubtitle ?? (panelTitle && panelTitle !== "Sign in" ? panelTitle : "Sign in");
  const wordmark = (productWordmark ?? productName).trim() || "Zoreon";

  return (
    <div className="login-page login-store-page flex min-h-screen flex-col">
      <main className="login-store-scroll" aria-label="Sign in">
        <section className="login-chapter login-chapter-hero" data-tone={accent} aria-label={productName}>
          <div className="login-chapter-inner">
            {logo ? <div className="login-logo mb-5 inline-flex">{logo}</div> : null}
            <p className="login-wordmark" aria-label={productName}>
              {wordmark}
            </p>
            <h1 className="login-hero-title">{heroTitle}</h1>
            {tagline ? <p className="login-tagline">{tagline}</p> : null}
            {pills?.length ? (
              <div className="login-pill-row">
                {pills.map((pill) => (
                  <span key={pill.label} data-tone={pill.tone ?? accent} className="login-pill">
                    <span className="login-pill-dot" aria-hidden />
                    {pill.icon}
                    {pill.label}
                  </span>
                ))}
              </div>
            ) : null}
            {heroCta ? <div className="login-cta">{heroCta}</div> : null}
            {chapterNote ? <p className="login-chapter-note">{chapterNote}</p> : null}
          </div>
        </section>

        {showSignInChapter && children ? (
          <section id="login-sign-in" className="login-chapter login-chapter-sign-in" aria-label="Credentials">
            <div className="login-chapter-inner login-sign-in-inner">
              <p className="login-form-heading">{formHeading}</p>
              <div className={`login-card ${formClassName}`.trim()}>{children}</div>
              {panelHint ? <p className="login-hint">{panelHint}</p> : null}
            </div>
          </section>
        ) : null}
      </main>

      {footer}
    </div>
  );
}

export function LoginError({ message }: { message: string }) {
  return (
    <div
      className="login-shake mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3"
      role="alert"
      aria-live="assertive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
      <div>
        <p className="text-sm font-medium text-red-700">Unable to sign in</p>
        <p className="mt-0.5 text-sm text-red-600/90">{message}</p>
      </div>
    </div>
  );
}

export function LoginSubmit({
  loading,
  disabled,
  children,
  className = "",
  onClick,
  type = "submit",
  variant = "primary",
}: {
  loading?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "submit" | "button";
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${variant === "secondary" ? "login-btn-secondary" : "login-btn-primary"} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

export function LoginField({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-zinc-500">
        {label}
      </label>
      <div className="group relative">{children}</div>
    </div>
  );
}

export function LoginDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="relative mt-2 py-3 text-center text-xs uppercase tracking-[0.18em] text-zinc-400">
      <span className="relative z-[1] bg-white px-3">{label}</span>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-zinc-200" />
    </div>
  );
}
