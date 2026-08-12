import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { Roles } from '../rbac/roles.decorator';
import { Scope } from '../rbac/scope.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { CreateMatchOfficialDto } from './dto/create-match-official.dto';
import { UpdateMatchOfficialDto } from './dto/update-match-official.dto';
import { MatchOfficialService } from './match-official.service';

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

@Controller('matches/:matchId/officials')
@UseGuards(RbacGuard)
export class MatchOfficialController {
  constructor(private readonly matchOfficialService: MatchOfficialService) {}

  @Get()
  @Roles(...readRoles)
  @Scope('tenant')
  findAll(@Param('matchId') matchId: string) {
    return this.matchOfficialService.findAll(matchId);
  }

  @Get(':id')
  @Roles(...readRoles)
  @Scope('tenant')
  findById(@Param('matchId') matchId: string, @Param('id') id: string) {
    return this.matchOfficialService.findById(matchId, id);
  }

  @Post()
  @Roles(...adminRoles)
  @Scope('tenant')
  create(
    @Param('matchId') matchId: string,
    @Body() dto: CreateMatchOfficialDto,
  ) {
    return this.matchOfficialService.create(matchId, dto);
  }

  @Patch(':id')
  @Roles(...adminRoles)
  @Scope('tenant')
  update(
    @Param('matchId') matchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMatchOfficialDto,
  ) {
    return this.matchOfficialService.update(matchId, id, dto);
  }

  @Delete(':id')
  @Roles(...adminRoles)
  @Scope('tenant')
  remove(@Param('matchId') matchId: string, @Param('id') id: string) {
    return this.matchOfficialService.remove(matchId, id);
  }
}
