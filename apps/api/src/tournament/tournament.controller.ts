import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../rbac/roles.decorator';
import { Scope } from '../rbac/scope.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { TournamentService } from './tournament.service';
import { RoleName } from '@prisma/client';

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
];

@Controller('tournaments')
@UseGuards(RbacGuard)
export class TournamentController {
  constructor(private readonly tournamentService: TournamentService) {}

  @Post()
  @Roles(...adminRoles)
  @Scope('tenant')
  create(@Body() dto: CreateTournamentDto) {
    return this.tournamentService.create(dto);
  }

  @Get()
  @Roles(...readRoles)
  @Scope('tenant')
  findAll() {
    return this.tournamentService.findAll();
  }

  @Get(':id')
  @Roles(...readRoles)
  @Scope('tenant')
  findById(@Param('id') id: string) {
    return this.tournamentService.findById(id);
  }

  @Patch(':id')
  @Roles(...adminRoles)
  @Scope('tenant')
  update(@Param('id') id: string, @Body() dto: UpdateTournamentDto) {
    return this.tournamentService.update(id, dto);
  }
}
