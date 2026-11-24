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
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { CalendarService } from './calendar.service';
import {
  CalendarQueryDto,
  CreateSchoolEventDto,
  UpdateSchoolEventDto,
} from './dto/school-event.dto';

/** The term calendar: holidays, exams and school events. */
@ApiTags('Tenant / Calendar')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  /** A month: holidays, exams and events, earliest first. */
  @Get('calendar')
  @RequirePermissions(PERMISSIONS.HOLIDAYS_READ)
  @ResponseMessage('Calendar')
  month(@Query() query: CalendarQueryDto) {
    return this.calendar.month(query.month, { classId: query.classId });
  }

  @Post('school-events')
  @RequirePermissions(PERMISSIONS.EVENTS_MANAGE)
  @ResponseMessage('Event added')
  create(@Body() dto: CreateSchoolEventDto) {
    return this.calendar.create(dto);
  }

  @Patch('school-events/:id')
  @RequirePermissions(PERMISSIONS.EVENTS_MANAGE)
  @ResponseMessage('Event updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSchoolEventDto,
  ) {
    return this.calendar.update(id, dto);
  }

  @Delete('school-events/:id')
  @RequirePermissions(PERMISSIONS.EVENTS_MANAGE)
  @ResponseMessage('Event removed')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.calendar.remove(id);
  }
}
