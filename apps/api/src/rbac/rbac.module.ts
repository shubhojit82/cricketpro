import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { RbacGuard } from './rbac.guard';

@Module({
  imports: [TenantModule],
  providers: [RbacGuard],
  exports: [RbacGuard],
})
export class RbacModule {}
