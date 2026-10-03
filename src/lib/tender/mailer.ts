import nodemailer from "nodemailer";
import type { Attachment } from "nodemailer/lib/mailer";
import type { EmailSettings } from "../settings";

export type SendMailOptions = {
  email: string | string[];
  subject: string;
  message: string;
  html?: string;
  attachments?: Attachment[];
  fromName?: string;
  fromEmail?: string;
  smtp: Pick<EmailSettings, "host" | "port" | "secure" | "user" | "pass" | "fromName">;
};

/** Resolve SMTP only from portal/DB settings (no .env credentials). */
export function resolveSmtp(em: Partial<EmailSettings>) {
  const port = Number(em.port || 587);
  const secure = typeof em.secure === "boolean" ? em.secure : port === 465;
  return {
    host: em.host || "smtp.gmail.com",
    port,
    secure,
    user: (em.user || "").trim(),
    pass: (em.pass || "").replace(/\s+/g, ""),
    fromName: em.fromName || "EnerScope",
  };
}

/**
 * Low-level nodemailer helper (supports Excel attachments).
 * Prefer sendDigestEmail for the daily digest flow.
 */
export const sendMail = async (options: SendMailOptions) => {
  const smtp = resolveSmtp(options.smtp);
  if (!smtp.user || !smtp.pass) {
    throw new Error("SMTP credentials missing. Add sender email + app password on Admin → Email and Save.");
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  const fromEmail = options.fromEmail || smtp.user;
  const fromName = options.fromName || smtp.fromName;

  return transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: Array.isArray(options.email) ? options.email.join(", ") : options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
    attachments: options.attachments || [],
  });
};

export async function sendDigestEmail(
  em: EmailSettings,
  args: { subject: string; text: string; attachment?: { filename: string; content: string } },
): Promise<string> {
  const smtp = resolveSmtp(em);
  if (!smtp.user || !smtp.pass) {
    throw new Error("Sender email / app password missing. Save them on Admin → Email for the current user.");
  }
  if (!em.recipients?.length) throw new Error("No recipients added (Email tab).");

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  await transporter.verify();

  const info = await transporter.sendMail({
    from: `"${smtp.fromName}" <${smtp.user}>`,
    to: em.recipients.join(", "),
    subject: args.subject,
    text: args.text,
    attachments: args.attachment
      ? [
          {
            filename: args.attachment.filename,
            content: Buffer.from(args.attachment.content, "utf8"),
            contentType: "application/vnd.ms-excel",
          },
        ]
      : [],
  });

  return `Sent from ${smtp.user} to ${em.recipients.length} recipient(s). MessageId: ${info.messageId}`;
}
