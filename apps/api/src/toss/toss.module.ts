import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RbacModule } from '../rbac/rbac.module';
import { MatchLifecycleModule } from '../match-lifecycle/match-lifecycle.module';
import { TossController } from './toss.controller';
import { TossService } from './toss.service';

@Module({
  imports: [DatabaseModule, TenantModule, AuditLogModule, RbacModule, MatchLifecycleModule],
  controllers: [TossController],
  providers: [TossService],
  exports: [TossService],
})
export class TossModule {}
