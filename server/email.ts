import type { Transporter } from "nodemailer";
import { ENV, isSmtpConfigured } from "./_core/env";

export type SimpleEmailPayload = {
  to: string;
  subject: string;
  result: string;
  viewUrl?: string | null;
};

export function formatSimpleEmailBody(payload: Pick<SimpleEmailPayload, "subject" | "result" | "viewUrl">): string {
  const lines = [`标题：${payload.subject}`, `结果：${payload.result}`];
  const viewUrl = payload.viewUrl?.trim();
  if (viewUrl) {
    lines.push(`查看：${viewUrl}`);
  }
  return lines.join("\n");
}

let cachedTransport: Transporter | null | undefined;

async function getTransport(): Promise<Transporter | null> {
  if (!isSmtpConfigured()) {
    return null;
  }
  if (cachedTransport === undefined) {
    const nodemailer = await import("nodemailer");
    cachedTransport = nodemailer.createTransport({
      host: ENV.smtpHost,
      port: ENV.smtpPort,
      secure: ENV.smtpPort === 465,
      auth: {
        user: ENV.smtpUser,
        pass: ENV.smtpPass,
      },
    });
  }
  return cachedTransport;
}

/** 未配置 SMTP 或收件人为空时静默跳过；发送失败仅打日志，不抛错。 */
export async function sendSimpleEmail(payload: SimpleEmailPayload): Promise<boolean> {
  const to = payload.to.trim();
  if (!to) {
    return false;
  }
  const transport = await getTransport();
  if (!transport) {
    if (process.env.NODE_ENV !== "test") {
      console.info("[email] SMTP 未配置，跳过发送:", payload.subject);
    }
    return false;
  }

  const from = ENV.smtpFrom.trim() || ENV.smtpUser;
  try {
    await transport.sendMail({
      from,
      to,
      subject: payload.subject,
      text: formatSimpleEmailBody(payload),
    });
    return true;
  } catch (error) {
    console.warn("[email] 发送失败:", payload.subject, error);
    return false;
  }
}
