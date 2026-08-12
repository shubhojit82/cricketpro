import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { Roles } from '../rbac/roles.decorator';
import { Scope } from '../rbac/scope.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { TossService } from './toss.service';
import { SetTossDto } from './dto/set-toss.dto';

const readRoles: RoleName[] = [
  RoleName.SUPER_ADMIN,
  RoleName.TENANT_ADMIN,
  RoleName.TOURNAMENT_ADMIN,
  RoleName.MATCH_REFEREE,
  RoleName.SCORER,
  RoleName.BACKUP_SCORER,
  RoleName.UMPIRE,
  RoleName.STATISTICIAN,
  RoleName.TEAM_MANAGER,
  RoleName.MEDIA_MANAGER,
  RoleName.BROADCAST_USER,
];

const adminRoles: RoleName[] = [
  RoleName.SUPER_ADMIN,
  RoleName.TENANT_ADMIN,
  RoleName.TOURNAMENT_ADMIN,
  RoleName.MATCH_REFEREE,
];

@Controller('matches/:matchId/toss')
@UseGuards(RbacGuard)
export class TossController {
  constructor(private readonly tossService: TossService) {}

  @Put()
  @Roles(...adminRoles)
  @Scope('tenant')
  setToss(@Param('matchId') matchId: string, @Body() dto: SetTossDto) {
    return this.tossService.setToss(matchId, dto);
  }

  @Get()
  @Roles(...readRoles)
  @Scope('tenant')
  getToss(@Param('matchId') matchId: string) {
    return this.tossService.getToss(matchId);
  }
}
