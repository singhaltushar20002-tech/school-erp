import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { CreateTimetableDto } from '../dto/create-timetable.dto';
import { FilterTimetableDto } from '../dto/filter-timetable.dto';
import { UpdateTimetableDto } from '../dto/update-timetable.dto';
import { ClassTimetableService } from '../services/class-timetable.service';
import { TimetableGridService } from '../services/timetable-grid.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Timetables')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('timetables')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClassTimetableController {
  constructor(
    private readonly timetableService: ClassTimetableService,
    private readonly grid_: TimetableGridService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TIMETABLES_READ)
  @ResponseMessage('List of timetable entries')
  findAll(@Query() filter: FilterTimetableDto) {
    return this.timetableService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TIMETABLES_CREATE)
  @ResponseMessage('Timetable entry created')
  create(@Body() dto: CreateTimetableDto) {
    return this.timetableService.create(dto);
  }

  /** The section's week as a grid, with whether it is published. */
  @Get('sections/:sectionId')
  @RequirePermissions(PERMISSIONS.TIMETABLES_READ)
  @ResponseMessage('Timetable')
  grid(@Param('sectionId', ParseUUIDPipe) sectionId: string) {
    return this.grid_.grid(sectionId);
  }

  /** Parents and students see it from now on. */
  @Post('sections/:sectionId/publish')
  @RequirePermissions(PERMISSIONS.TIMETABLES_UPDATE)
  @ResponseMessage('Timetable published')
  publish(@Param('sectionId', ParseUUIDPipe) sectionId: string) {
    return this.grid_.publish(sectionId);
  }

  @Delete('sections/:sectionId/publish')
  @RequirePermissions(PERMISSIONS.TIMETABLES_UPDATE)
  @ResponseMessage('Timetable unpublished')
  unpublish(@Param('sectionId', ParseUUIDPipe) sectionId: string) {
    return this.grid_.unpublish(sectionId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TIMETABLES_READ)
  @ResponseMessage('Timetable entry found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.timetableService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TIMETABLES_UPDATE)
  @ResponseMessage('Timetable entry updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimetableDto,
  ) {
    return this.timetableService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.TIMETABLES_DELETE)
  @ResponseMessage('Timetable entry deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.timetableService.remove(id);
  }
}
