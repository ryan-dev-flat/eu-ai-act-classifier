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

function renderTemplate(template: string, data: Record<string, unknown>): { subject: string; text: string } {
  if (template === 'workflow.task_created') {
    const role = String(data.role ?? 'reviewer');
    const classificationId = String(data.classificationId ?? 'unknown');
    const workflowId = String(data.workflowId ?? data.entityId ?? 'unknown');
    return {
      subject: '[eu-ai-act] New review task assigned',
      text: [
        `A new ${role} review task has been created.`,
        '',
        `Classification: ${classificationId}`,
        `Workflow: ${workflowId}`,
        `Task: ${String(data.taskId ?? 'unknown')}`,
        '',
        'Please open the EU AI Act Risk Classifier to review this item.',
      ].join('\n'),
    };
  }

  return {
    subject: `[eu-ai-act] ${template}`,
    text: JSON.stringify(data, null, 2),
  };
}

export async function sendEmail({ to, template, data }: SendInput): Promise<void> {
  const rendered = renderTemplate(template, data);
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM ?? 'EU AI Act Classifier <noreply@local.eu-ai-act.dev>',
    to,
    subject: rendered.subject,
    text: rendered.text,
  });
}
