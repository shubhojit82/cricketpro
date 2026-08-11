import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RbacModule } from '../rbac/rbac.module';
import { PlayingXiController } from './playing-xi.controller';
import { PlayingXiService } from './playing-xi.service';

@Module({
  imports: [DatabaseModule, TenantModule, AuditLogModule, RbacModule],
  controllers: [PlayingXiController],
  providers: [PlayingXiService],
  exports: [PlayingXiService],
})
export class PlayingXiModule {}
