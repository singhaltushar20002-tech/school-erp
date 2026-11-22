import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
  AssignStopDto,
  CreateRouteDto,
  TransportBillingDto,
  UpdateRouteDto,
} from './transport.dto';
import { TransportService } from './transport.service';

/** Bus routes, stops, students on stops, billing and the live position. */
@ApiTags('Tenant / Transport')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('transport')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule(PLAN_MODULES.TRANSPORT)
export class TransportController {
  constructor(private readonly transport: TransportService) {}

  @Get('routes')
  @RequirePermissions(PERMISSIONS.TRANSPORT_READ)
  @ResponseMessage('Routes')
  list() {
    return this.transport.list();
  }

  @Post('routes')
  @RequirePermissions(PERMISSIONS.TRANSPORT_MANAGE)
  @ResponseMessage('Route added')
  create(@Body() dto: CreateRouteDto) {
    return this.transport.create(dto);
  }

  @Patch('routes/:id')
  @RequirePermissions(PERMISSIONS.TRANSPORT_MANAGE)
  @ResponseMessage('Route updated')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRouteDto) {
    return this.transport.update(id, dto);
  }

  @Delete('routes/:id')
  @RequirePermissions(PERMISSIONS.TRANSPORT_MANAGE)
  @ResponseMessage('Route removed')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.transport.remove(id);
  }

  @Get('routes/:id/students')
  @RequirePermissions(PERMISSIONS.TRANSPORT_READ)
  @ResponseMessage('Students on the route')
  students(@Param('id', ParseUUIDPipe) id: string) {
    return this.transport.students_(id);
  }

  @Get('routes/:id/live')
  @RequirePermissions(PERMISSIONS.TRANSPORT_READ)
  @ResponseMessage('Bus position')
  live(@Param('id', ParseUUIDPipe) id: string) {
    return this.transport.live(id);
  }

  @Put('assignments')
  @RequirePermissions(PERMISSIONS.TRANSPORT_MANAGE)
  @ResponseMessage('Stop assigned')
  assign(@Body() dto: AssignStopDto) {
    return this.transport.assign(dto.studentId, dto.stopId);
  }

  @Delete('assignments/:studentId')
  @RequirePermissions(PERMISSIONS.TRANSPORT_MANAGE)
  @ResponseMessage('Taken off transport')
  async unassign(@Param('studentId', ParseUUIDPipe) studentId: string) {
    await this.transport.unassign(studentId);
  }

  /** One transport bill per student for the month (skips those billed). */
  @Post('billing')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.TRANSPORT_MANAGE)
  @ResponseMessage('Transport billed')
  bill(@Body() dto: TransportBillingDto) {
    return this.transport.bill(dto.period);
  }
}
