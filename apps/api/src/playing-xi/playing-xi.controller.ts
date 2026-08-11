import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { Roles } from '../rbac/roles.decorator';
import { Scope } from '../rbac/scope.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { PlayingXiService } from './playing-xi.service';
import { SetPlayingXiDto } from './dto/set-playing-xi.dto';
import { UpdatePlayingXiPlayerDto } from './dto/update-playing-xi-player.dto';

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
  RoleName.TEAM_MANAGER,
];

@Controller('matches/:matchId/teams/:teamId/playing-xi')
@UseGuards(RbacGuard)
export class PlayingXiController {
  constructor(private readonly playingXiService: PlayingXiService) {}

  @Put()
  @Roles(...adminRoles)
  @Scope('tenant')
  setPlayingXI(
    @Param('matchId') matchId: string,
    @Param('teamId') teamId: string,
    @Body() dto: SetPlayingXiDto,
  ) {
    return this.playingXiService.setPlayingXI(matchId, teamId, dto);
  }

  @Get()
  @Roles(...readRoles)
  @Scope('tenant')
  getPlayingXI(
    @Param('matchId') matchId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.playingXiService.getPlayingXI(matchId, teamId);
  }

  @Patch(':playerId')
  @Roles(...adminRoles)
  @Scope('tenant')
  updatePlayer(
    @Param('matchId') matchId: string,
    @Param('teamId') teamId: string,
    @Param('playerId') playerId: string,
    @Body() dto: UpdatePlayingXiPlayerDto,
  ) {
    return this.playingXiService.updatePlayer(matchId, teamId, playerId, dto);
  }

  @Delete(':playerId')
  @Roles(...adminRoles)
  @Scope('tenant')
  removePlayer(
    @Param('matchId') matchId: string,
    @Param('teamId') teamId: string,
    @Param('playerId') playerId: string,
  ) {
    return this.playingXiService.removePlayer(matchId, teamId, playerId);
  }
}
