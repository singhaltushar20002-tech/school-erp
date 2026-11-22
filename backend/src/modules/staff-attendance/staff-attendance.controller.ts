import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequireModule } from '~/modules/plans/decorators/require-module.decorator';
import { PLAN_MODULES } from '~/modules/plans/plans.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import {
  AssignSubstituteDto,
  CreateStaffLeaveDto,
  DayQueryDto,
  FilterStaffLeaveDto,
  LeaveDecisionDto,
  MarkStaffDto,
  MonthQueryDto,
} from './dto/staff-attendance.dto';
import { StaffAttendanceService } from './staff-attendance.service';

/** Staff attendance, staff leave and substitute teachers. */
@ApiTags('Tenant / Staff attendance')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule(PLAN_MODULES.HR)
export class StaffAttendanceController {
  constructor(private readonly staff: StaffAttendanceService) {}

  @Get('staff-attendance')
  @RequirePermissions(PERMISSIONS.STAFF_ATTENDANCE_MANAGE)
  @ResponseMessage('Staff attendance')
  day(@Query() query: DayQueryDto) {
    return this.staff.day(query.date);
  }

  @Put('staff-attendance')
  @RequirePermissions(PERMISSIONS.STAFF_ATTENDANCE_MANAGE)
  @ResponseMessage('Staff attendance saved')
  mark(@Body() dto: MarkStaffDto) {
    return this.staff.mark(dto);
  }

  @Get('staff-attendance/month')
  @RequirePermissions(
    PERMISSIONS.STAFF_ATTENDANCE_MANAGE,
    PERMISSIONS.PAYROLL_READ,
  )
  @ResponseMessage('Staff attendance for the month')
  month(@Query() query: MonthQueryDto) {
    return this.staff.month(query.month);
  }

  @Get('staff-leaves')
  @RequirePermissions(
    PERMISSIONS.STAFF_LEAVES_APPROVE,
    PERMISSIONS.STAFF_ATTENDANCE_MANAGE,
  )
  @ResponseMessage('Staff leave')
  leaves(@Query() query: FilterStaffLeaveDto) {
    return this.staff.listLeaves(query.status);
  }

  @Post('staff-leaves')
  @RequirePermissions(PERMISSIONS.STAFF_LEAVES_APPROVE)
  @ResponseMessage('Leave recorded')
  createLeave(@Body() dto: CreateStaffLeaveDto) {
    return this.staff.createLeave(dto);
  }

  @Post('staff-leaves/:id/decision')
  @RequirePermissions(PERMISSIONS.STAFF_LEAVES_APPROVE)
  @ResponseMessage('Leave decided')
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LeaveDecisionDto,
  ) {
    return this.staff.decide(id, dto.approve);
  }

  @Get('substitutions')
  @RequirePermissions(PERMISSIONS.SUBSTITUTIONS_MANAGE)
  @ResponseMessage('Uncovered periods')
  substitutions(@Query() query: DayQueryDto) {
    return this.staff.substitutionsFor(query.date);
  }

  @Put('substitutions')
  @RequirePermissions(PERMISSIONS.SUBSTITUTIONS_MANAGE)
  @ResponseMessage('Substitute saved')
  assign(@Body() dto: AssignSubstituteDto) {
    return this.staff.assignSubstitute(dto);
  }
}
