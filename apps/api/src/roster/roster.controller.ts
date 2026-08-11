import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../rbac/roles.decorator';
import { Scope } from '../rbac/scope.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RoleName } from '@prisma/client';
import { AddPlayerToTeamDto } from './dto/add-player-to-team.dto';
import { RosterService } from './roster.service';

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
  RoleName.TEAM_MANAGER,
];

@Controller('teams')
@UseGuards(RbacGuard)
export class RosterController {
  constructor(private readonly rosterService: RosterService) {}

  @Post(':teamId/players')
  @Roles(...adminRoles)
  @Scope('tenant')
  addPlayer(
    @Param('teamId') teamId: string,
    @Body() dto: AddPlayerToTeamDto,
  ) {
    return this.rosterService.addPlayer(teamId, dto.playerId);
  }

  @Get(':teamId/players')
  @Roles(...readRoles)
  @Scope('tenant')
  listPlayers(@Param('teamId') teamId: string) {
    return this.rosterService.listPlayers(teamId);
  }

  @Delete(':teamId/players/:playerId')
  @Roles(...adminRoles)
  @Scope('tenant')
  removePlayer(
    @Param('teamId') teamId: string,
    @Param('playerId') playerId: string,
  ) {
    return this.rosterService.removePlayer(teamId, playerId);
  }
}
