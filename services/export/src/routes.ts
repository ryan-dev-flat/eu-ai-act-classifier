import type { FastifyInstance, FastifyRequest } from 'fastify';
import { CreateExportRequest } from '@eu-ai-act/shared-types';
import { requireAuth } from '@eu-ai-act/auth';
import { createExportRecord, findExportRecord, loadClassificationMemoData } from './repository.js';
import {
  renderClassificationMemoMarkdown,
  renderReadinessReportMarkdown,
  renderSimplePdf,
  renderClassificationMemoDocx,
  renderReadinessReportDocx,
} from './renderers.js';
import { readExportFile, writeExportFile } from './storage.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/exports', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = CreateExportRequest.parse(req.body);

    let bytes: Buffer | string;
    let classificationId: string | null = body.classificationId ?? null;

    if (body.type === 'classification_memo') {
      if (!body.classificationId) {
        return reply.code(400).send({ error: 'classification_id_required' });
      }
      const data = await loadClassificationMemoData(req.authContext.tenantId, body.classificationId);
      if (!data) return reply.code(404).send({ error: 'classification_not_found' });
      if (body.format === 'docx') {
        bytes = await renderClassificationMemoDocx(data);
      } else {
        const markdown = renderClassificationMemoMarkdown(data);
        bytes = body.format === 'pdf' ? renderSimplePdf(markdown) : markdown;
      }
    } else {
      classificationId = null;
      const report = await fetchAug2026Report(req);
      if (body.format === 'docx') {
        bytes = await renderReadinessReportDocx(report);
      } else {
        const markdown = renderReadinessReportMarkdown(report);
        bytes = body.format === 'pdf' ? renderSimplePdf(markdown) : markdown;
      }
    }

    const fileRef = await writeExportFile({
      tenantId: req.authContext.tenantId,
      type: body.type,
      format: body.format,
      bytes,
    });
    const record = await createExportRecord(req.authContext.tenantId, {
      classificationId,
      type: body.type,
      format: body.format,
      fileRef,
      generatedBy: req.authContext.userId,
    });
    return reply.code(201).send({ ...record, downloadUrl: `/v1/exports/${record.exportId}` });
  });

  app.get<{ Params: { id: string } }>('/v1/exports/:id', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const record = await findExportRecord(req.authContext.tenantId, req.params.id);
    if (!record) return reply.code(404).send({ error: 'not_found' });
    const content = await readExportFile(record.fileRef);
    const extMap: Record<string, string> = { pdf: 'pdf', markdown: 'md', docx: 'docx' };
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      markdown: 'text/markdown; charset=utf-8',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const ext = extMap[record.format] ?? 'bin';
    const filename = `${record.type}-${record.exportId}.${ext}`;
    reply.header('content-disposition', `attachment; filename="${filename}"`);
    reply.type(mimeMap[record.format] ?? 'application/octet-stream');
    return reply.send(content);
  });
}

async function fetchAug2026Report(req: FastifyRequest): Promise<unknown> {
  const root = (process.env.TIMELINE_URL ?? 'http://localhost:4004').replace(/\/$/, '');
  const headers: Record<string, string> = {};
  if (req.authContext?.token) {
    headers.authorization = `Bearer ${req.authContext.token}`;
  } else if (req.authContext) {
    headers['x-tenant-id'] = req.authContext.tenantId;
    headers['x-user-id'] = req.authContext.userId;
    headers['x-roles'] = req.authContext.roles.join(',');
  }
  const res = await fetch(`${root}/v1/timeline/report/aug2026`, { headers });
  if (!res.ok) {
    throw new Error(`timeline report fetch failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
