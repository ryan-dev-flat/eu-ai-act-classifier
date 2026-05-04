import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: false,
    });
  }
  return transporter;
}

export interface SendInput {
  to: string;
  template: string;
  data: Record<string, unknown>;
}

export async function sendEmail({ to, template, data }: SendInput): Promise<void> {
  // Templates are rendered from a registry once the implementation lands.
  // For the skeleton we send a minimal payload so SMTP delivery (Mailhog) is testable.
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `[eu-ai-act] ${template}`,
    text: JSON.stringify(data, null, 2),
  });
}
