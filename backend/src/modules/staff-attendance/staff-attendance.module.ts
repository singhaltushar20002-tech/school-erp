import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { PlanModule } from '~/modules/plans/plan.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { StaffAttendanceController } from './staff-attendance.controller';
import { StaffAttendanceService } from './staff-attendance.service';
import {
  StaffAttendanceRepository,
  StaffLeaveRepository,
  SubstitutionRepository,
} from './staff.repositories';

@Module({
  imports: [RbacModule, AcademicYearModule, SettingsModule, PlanModule],
  controllers: [StaffAttendanceController],
  providers: [
    StaffAttendanceRepository,
    StaffLeaveRepository,
    SubstitutionRepository,
    StaffAttendanceService,
  ],
  exports: [StaffAttendanceService],
})
export class StaffAttendanceModule {}
