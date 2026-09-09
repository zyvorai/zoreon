import { useEffect, useRef, useState } from "react";
import { Check, Copy, Link2, Mail, RefreshCw, Send, X } from "lucide-react";
import {
  getInviteLink,
  regenerateInviteLink,
  sendInviteEmail,
  smtpStatus,
} from "@/lib/zoreon/api";

type InviteDialogProps = {
  open: boolean;
  onClose: () => void;
};

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function InviteDialog({ open, onClose }: InviteDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [smtpOk, setSmtpOk] = useState(false);
  const [emails, setEmails] = useState("");
  const [sendMsg, setSendMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async (regenerate: boolean) => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const [res, smtp] = await Promise.all([
        regenerate ? regenerateInviteLink() : getInviteLink(),
        smtpStatus().catch(() => ({ configured: false })),
      ]);
      setSmtpOk(smtp.configured);
      setUrl(`${window.location.origin}${res.path}`);
    } catch (err) {
      setUrl(null);
      setError(err instanceof Error ? err.message : "Could not create invite link");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void load(false);
  }, [open]);

  if (!open) return null;

  const mailto = url
    ? `mailto:?subject=${encodeURIComponent("Join Zyvor on Zoreon")}&body=${encodeURIComponent(
        `You're invited to the Zyvor workspace on Zoreon.\n\nJoin here:\n${url}\n`,
      )}`
    : null;

  const sendEmails = async () => {
    if (!url) return;
    const list = emails
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
    if (list.length === 0) {
      setError("Enter one or more email addresses");
      return;
    }
    setBusy(true);
    setError(null);
    setSendMsg(null);
    try {
      const res = await sendInviteEmail({
        data: { emails: list, origin: window.location.origin },
      });
      setSendMsg(
        `Sent ${res.sent.length}${res.failed.length ? ` · ${res.failed.length} failed` : ""}`,
      );
      setEmails("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-desktop/55 px-4 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Dismiss" onClick={onClose} />
      <div
        role="dialog"
        aria-labelledby="invite-title"
        className="relative z-10 w-full max-w-md rounded-lg border border-border-strong bg-panel p-4 shadow-window"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p id="invite-title" className="text-sm font-semibold text-fg">
              Invite people
            </p>
            <p className="mt-0.5 text-xs text-fg-subtle">
              Multi-use workspace link. Anyone with it can create an account.
            </p>
          </div>
          <button
            type="button"
            className="rounded-sm p-1 text-fg-subtle hover:bg-fg/10 hover:text-fg"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {error ? <p className="mb-3 text-xs text-danger">{error}</p> : null}
        {sendMsg ? <p className="mb-3 text-xs text-success">{sendMsg}</p> : null}

        <label className="mb-1 block text-xs font-medium text-fg-muted" htmlFor="invite-url">
          Invite link
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            id="invite-url"
            readOnly
            value={busy && !url ? "Creating link…" : (url ?? "")}
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 min-w-0 flex-1 rounded-sm border border-border bg-composer px-2 font-mono text-xs text-fg outline-none"
          />
          <button
            type="button"
            disabled={!url || busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-accent px-3 text-xs font-medium text-accent-fg disabled:opacity-40"
            onClick={() => {
              if (!url) return;
              void copyText(url).then((ok) => {
                setCopied(ok);
                if (ok) window.setTimeout(() => setCopied(false), 2000);
                inputRef.current?.select();
              });
            }}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <label className="mb-1 mt-3 block text-xs font-medium text-fg-muted" htmlFor="invite-emails">
          Email invites
        </label>
        <div className="flex gap-2">
          <input
            id="invite-emails"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="alice@zyvor.dev, bob@…"
            disabled={busy || !smtpOk}
            className="h-9 min-w-0 flex-1 rounded-sm border border-border bg-composer px-2 text-xs outline-none disabled:opacity-50"
          />
          <button
            type="button"
            disabled={busy || !smtpOk || !emails.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-border px-3 text-xs disabled:opacity-40"
            onClick={() => void sendEmails()}
            title={smtpOk ? "Send via SMTP" : "Configure SMTP_HOST and SMTP_FROM"}
          >
            <Send className="size-3.5" />
            Send
          </button>
        </div>
        {!smtpOk ? (
          <p className="mt-1 text-xs text-fg-subtle">
            SMTP not configured — use mailto or copy the link. Set SMTP_HOST / SMTP_FROM to enable Send.
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-fg-subtle">
            <Link2 className="mr-1 inline size-3 align-text-bottom" />
            Share via chat or email.
          </p>
          <div className="flex items-center gap-1">
            {mailto ? (
              <a
                href={mailto}
                className="inline-flex h-8 items-center gap-1 rounded-sm px-2 text-xs text-fg-muted hover:bg-fg/10 hover:text-fg"
              >
                <Mail className="size-3.5" />
                Email invite
              </a>
            ) : null}
            <button
              type="button"
              disabled={busy}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-sm px-2 text-xs text-fg-muted hover:bg-fg/10 hover:text-fg disabled:opacity-40"
              onClick={() => void load(true)}
            >
              <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
              Regenerate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
