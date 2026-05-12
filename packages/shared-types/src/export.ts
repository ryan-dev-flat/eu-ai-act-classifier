import { z } from 'zod';

export const ExportType = z.enum(['classification_memo', 'aug2026_readiness']);
export type ExportType = z.infer<typeof ExportType>;

export const ExportFormat = z.enum(['pdf', 'markdown', 'docx']);
export type ExportFormat = z.infer<typeof ExportFormat>;

export const CreateExportRequest = z.object({
  type: ExportType,
  format: ExportFormat,
  classificationId: z.string().uuid().optional(),
});
export type CreateExportRequest = z.infer<typeof CreateExportRequest>;

export const ExportRecord = z.object({
  exportId: z.string().uuid(),
  classificationId: z.string().uuid().nullable(),
  type: ExportType,
  format: ExportFormat,
  fileRef: z.string(),
  downloadUrl: z.string(),
  generatedAt: z.string().datetime(),
});
export type ExportRecord = z.infer<typeof ExportRecord>;
