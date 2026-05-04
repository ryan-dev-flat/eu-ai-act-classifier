import 'dotenv/config';
import { z } from 'zod';

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().url(),
  AUDIT_DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  OPA_URL: z.string().url(),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('eu-west-1'),
  S3_BUCKET: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  JWT_ISSUER: z.string().url(),
  JWT_AUDIENCE: z.string(),
  JWT_JWKS_URL: z.string().url(),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_FROM: z.string(),
  RULES_DIR: z.string().default('./rules'),
  RULES_ACTIVE_VERSION: z.string().default('v1'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAMESPACE: z.string().default('eu-ai-act'),
});

export type BaseEnv = z.infer<typeof baseSchema>;

export function loadEnv<T extends z.ZodRawShape>(extra?: z.ZodObject<T>): BaseEnv & z.infer<z.ZodObject<T>> {
  const merged = extra ? baseSchema.merge(extra) : baseSchema;
  const parsed = merged.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data as BaseEnv & z.infer<z.ZodObject<T>>;
}
