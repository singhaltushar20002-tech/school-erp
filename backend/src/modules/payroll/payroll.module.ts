import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { FileModule } from '~/modules/files/file.module';
import { JobModule } from '~/modules/jobs/job.module';
import { PlanModule } from '~/modules/plans/plan.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { StaffAttendanceModule } from '~/modules/staff-attendance/staff-attendance.module';
import { PayrollController } from './payroll.controller';
import { PayrollJobs } from './payroll.jobs';
import {
  PayrollRunRepository,
  PayrollService,
  PayslipRepository,
  SalaryStructureRepository,
} from './payroll.service';

@Module({
  imports: [
    RbacModule,
    FileModule,
    JobModule,
    PlanModule,
    SettingsModule,
    StaffAttendanceModule,
  ],
  controllers: [PayrollController],
  providers: [
    SalaryStructureRepository,
    PayrollRunRepository,
    PayslipRepository,
    PayrollService,
    PayrollJobs,
  ],
})
export class PayrollModule {}
