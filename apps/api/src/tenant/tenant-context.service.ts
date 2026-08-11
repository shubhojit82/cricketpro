import { Injectable, Scope } from '@nestjs/common';
import type { Tenant } from './tenant.types';

@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  private tenant: Tenant | null = null;

  setTenant(tenant: Tenant): void {
    this.tenant = tenant;
  }

  getTenant(): Tenant | null {
    return this.tenant;
  }

  getTenantId(): string | null {
    return this.tenant?.id ?? null;
  }

  requireTenant(): Tenant {
    if (!this.tenant) {
      throw new Error('Tenant context is not initialized');
    }

    return this.tenant;
  }
}
