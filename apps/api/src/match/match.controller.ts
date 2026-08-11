import {
  Body,
  Controller,
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
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { UpdateMatchStatusDto } from './dto/update-match-status.dto';
import { MatchService } from './match.service';

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

@Controller('matches')
@UseGuards(RbacGuard)
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Post()
  @Roles(...adminRoles)
  @Scope('tenant')
  create(@Body() dto: CreateMatchDto) {
    return this.matchService.create(dto);
  }

  @Get()
  @Roles(...readRoles)
  @Scope('tenant')
  findAll() {
    return this.matchService.findAll();
  }

  @Get(':id')
  @Roles(...readRoles)
  @Scope('tenant')
  findById(@Param('id') id: string) {
    return this.matchService.findById(id);
  }

  @Patch(':id')
  @Roles(...adminRoles)
  @Scope('tenant')
  update(@Param('id') id: string, @Body() dto: UpdateMatchDto) {
    return this.matchService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(...adminRoles)
  @Scope('tenant')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateMatchStatusDto) {
    return this.matchService.updateStatus(id, dto);
  }
}
