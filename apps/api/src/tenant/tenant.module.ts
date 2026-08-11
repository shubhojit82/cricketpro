import { Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { TenantMiddleware } from './tenant.middleware';
import { TenantService } from './tenant.service';

@Module({
  providers: [
    TenantService,
    TenantContextService,
    TenantMiddleware,
  ],
  exports: [
    TenantService,
    TenantContextService,
    TenantMiddleware,
  ],
})
export class TenantModule {}
