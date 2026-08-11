import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RbacModule } from '../rbac/rbac.module';
import { VenueController } from './venue.controller';
import { VenueService } from './venue.service';

@Module({
  imports: [DatabaseModule, TenantModule, AuditLogModule, RbacModule],
  controllers: [VenueController],
  providers: [VenueService],
  exports: [VenueService],
})
export class VenueModule {}
