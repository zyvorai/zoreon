import nodemailer from "nodemailer";

export class SmtpNotConfigured extends Error {
  constructor() {
    super("SMTP is not configured (set SMTP_HOST, SMTP_FROM, and credentials)");
    this.name = "SmtpNotConfigured";
  }
}

/** Prefer Zoreon names; also accept zyvor-web contact-mailer.env aliases. */
function smtpUser(): string | undefined {
  return (
    process.env.SMTP_USER?.trim() ||
    process.env.SMTP_USERNAME?.trim() ||
    undefined
  );
}

function smtpPass(): string | undefined {
  return (
    process.env.SMTP_PASS?.trim() ||
    process.env.SMTP_PASSWORD?.trim() ||
    undefined
  );
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_FROM?.trim() &&
      smtpUser() &&
      smtpPass(),
  );
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  if (!isSmtpConfigured()) throw new SmtpNotConfigured();
  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT || "587");
  const user = smtpUser()!;
  const pass = smtpPass()!;
  const from = process.env.SMTP_FROM!.trim();
  const useTls = (process.env.SMTP_USE_TLS ?? "true").toLowerCase() !== "false";

  const transporter = nodemailer.createTransport({
    host,
    port,
    // 465 = implicit TLS; 587 = STARTTLS (requireTLS)
    secure: port === 465,
    requireTLS: useTls && port !== 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html ?? input.text.replace(/\n/g, "<br/>"),
  });
}
