import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { AttendanceModule } from '~/modules/attendance/attendance.module';
import { AuthModule } from '~/modules/auth/auth.module';
import { EnrollmentModule } from '~/modules/enrollments/enrollment.module';
import { ExamModule } from '~/modules/exams/exam.module';
import { FeeModule } from '~/modules/fees/fee.module';
import { GuardianModule } from '~/modules/guardians/guardian.module';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { NoticeModule } from '~/modules/notices/notice.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { StudentModule } from '~/modules/students/student.module';
import { PortalController } from './controllers/portal.controller';
import { PortalAccessService } from './services/portal-access.service';
import { PortalService } from './services/portal.service';

/** The guardian and student portal API (`/portal/*`, PRD 6.14). */
import { TimetableModule } from '~/modules/timetable/timetable.module';
import { HomeworkModule } from '~/modules/homework/homework.module';
import { CalendarModule } from '~/modules/calendar/calendar.module';
import { TransportModule } from '~/modules/transport/transport.module';
import { LibraryModule } from '~/modules/library/library.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Membership]),
    RbacModule,
    AuthModule,
    AcademicYearModule,
    StudentModule,
    GuardianModule,
    EnrollmentModule,
    AttendanceModule,
    ExamModule,
    FeeModule,
    NoticeModule,
    SettingsModule,
    TimetableModule,
    HomeworkModule,
    CalendarModule,
    TransportModule,
    LibraryModule,
  ],
  controllers: [PortalController],
  providers: [PortalAccessService, PortalService],
})
export class PortalModule {}
