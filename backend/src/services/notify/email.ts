import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env.js";
import type { EmailMessage, SendResult } from "./types.js";

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  transporter = env.SMTP_HOST
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      })
    : null;
  return transporter;
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const transport = getTransporter();
  if (!transport) return { status: "SKIPPED", reason: "SMTP not configured" };
  try {
    const info = await transport.sendMail({ from: env.MAIL_FROM, ...message });
    return { status: "SENT", providerRef: info.messageId };
  } catch (error) {
    return { status: "FAILED", error: error instanceof Error ? error.message : String(error) };
  }
}
