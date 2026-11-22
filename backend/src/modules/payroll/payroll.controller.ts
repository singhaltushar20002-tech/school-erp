import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { CreateRunDto, SalaryStructureDto } from './payroll.dto';
import { PayrollService } from './payroll.service';

/** Salary structures, monthly payroll runs and payslips. */
@ApiTags('Tenant / Payroll')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('payroll')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule(PLAN_MODULES.HR)
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('structures')
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  @ResponseMessage('Salary structures')
  structures() {
    return this.payroll.listStructures();
  }

  @Put('structures/:employeeId')
  @RequirePermissions(PERMISSIONS.PAYROLL_MANAGE)
  @ResponseMessage('Salary saved')
  setStructure(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: SalaryStructureDto,
  ) {
    return this.payroll.setStructure(employeeId, dto);
  }

  @Get('runs')
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  @ResponseMessage('Payroll runs')
  runs() {
    return this.payroll.listRuns();
  }

  /** Works out every payslip for the month (a draft until finalised). */
  @Post('runs')
  @RequirePermissions(PERMISSIONS.PAYROLL_MANAGE)
  @ResponseMessage('Payroll prepared')
  createRun(@Body() dto: CreateRunDto) {
    return this.payroll.createRun(dto);
  }

  @Get('runs/:id')
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  @ResponseMessage('Payroll run')
  run(@Param('id', ParseUUIDPipe) id: string) {
    return this.payroll.run(id);
  }

  @Post('runs/:id/recalculate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PAYROLL_MANAGE)
  @ResponseMessage('Payroll recalculated')
  recalculate(@Param('id', ParseUUIDPipe) id: string) {
    return this.payroll.recalculate(id);
  }

  @Post('runs/:id/finalize')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PAYROLL_MANAGE)
  @ResponseMessage('Payroll finalised')
  finalize(@Param('id', ParseUUIDPipe) id: string) {
    return this.payroll.finalize(id);
  }

  /** The payslip as a PDF; poll `GET /jobs/:id`. */
  @Post('payslips/:id/pdf')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  @ResponseMessage('Payslip PDF started')
  pdf(@Param('id', ParseUUIDPipe) id: string) {
    return this.payroll.startPayslipPdf(id);
  }
}
