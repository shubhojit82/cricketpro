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
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { VenueService } from './venue.service';

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

@Controller('venues')
@UseGuards(RbacGuard)
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Post()
  @Roles(...adminRoles)
  @Scope('tenant')
  create(@Body() dto: CreateVenueDto) {
    return this.venueService.create(dto);
  }

  @Get()
  @Roles(...readRoles)
  @Scope('tenant')
  findAll() {
    return this.venueService.findAll();
  }

  @Get(':id')
  @Roles(...readRoles)
  @Scope('tenant')
  findById(@Param('id') id: string) {
    return this.venueService.findById(id);
  }

  @Patch(':id')
  @Roles(...adminRoles)
  @Scope('tenant')
  update(@Param('id') id: string, @Body() dto: UpdateVenueDto) {
    return this.venueService.update(id, dto);
  }
}
