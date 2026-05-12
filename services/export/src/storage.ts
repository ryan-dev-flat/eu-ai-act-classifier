import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ExportFormat, ExportType } from '@eu-ai-act/shared-types';

const storageRoot = resolve(process.cwd(), process.env.EXPORT_STORAGE_DIR ?? 'generated/exports');

export async function writeExportFile(input: {
  tenantId: string;
  type: ExportType;
  format: ExportFormat;
  bytes: Buffer | string;
}): Promise<string> {
  const extMap: Record<string, string> = { pdf: 'pdf', markdown: 'md', docx: 'docx' };
  const ext = extMap[input.format] ?? 'bin';
  const safeType = input.type.replace(/[^a-z0-9_-]/gi, '_');
  const id = randomUUID();
  const relative = `${input.tenantId}/${safeType}-${id}.${ext}`;
  const fullPath = resolve(storageRoot, relative);
  await mkdir(resolve(fullPath, '..'), { recursive: true });
  await writeFile(fullPath, input.bytes);
  return relative.replace(/\\/g, '/');
}

export async function readExportFile(fileRef: string): Promise<Buffer> {
  const fullPath = resolve(storageRoot, fileRef);
  if (!fullPath.startsWith(storageRoot)) {
    throw new Error('invalid file reference');
  }
  return readFile(fullPath);
}
