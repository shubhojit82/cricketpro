import type { Tenant as PrismaTenant } from '@prisma/client';

export type Tenant = PrismaTenant;

export interface TenantValidationResult {
  isValid: boolean;
  tenant?: Tenant;
  error?: string;
}
