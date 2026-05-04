import { z } from 'zod';

export const UserRole = z.enum([
  'submitter',
  'reviewer_legal',
  'reviewer_privacy',
  'reviewer_governance',
  'admin',
  'auditor',
  'super_admin',
]);
export type UserRole = z.infer<typeof UserRole>;

export const PrivilegeFlag = z.enum(['legal_privilege', 'sensitive', 'export_restricted']);
export type PrivilegeFlag = z.infer<typeof PrivilegeFlag>;

export const TenantConfig = z.object({
  id: z.string().uuid(),
  name: z.string(),
  region: z.enum(['eu-west-1', 'eu-central-1', 'us-east-1']),
  policyOverlayId: z.string().uuid().nullable(),
  ssoProvider: z.enum(['okta', 'azure_ad', 'google', 'none']).default('none'),
  defaultApprovalChainId: z.string().uuid().nullable(),
});
export type TenantConfig = z.infer<typeof TenantConfig>;
