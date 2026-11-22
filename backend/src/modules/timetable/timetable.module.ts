import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { ClassModule } from '~/modules/classes/class.module';
import { EmployeeModule } from '~/modules/employees/employee.module';
import { SectionModule } from '~/modules/sections/section.module';
import { SubjectModule } from '~/modules/subjects/subject.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { PeriodController } from './controllers/period.controller';
import { ClassTimetableController } from './controllers/class-timetable.controller';
import { PeriodRepository } from './repositories/period.repository';
import { ClassTimetableRepository } from './repositories/class-timetable.repository';
import { PeriodService } from './services/period.service';
import { ClassTimetableService } from './services/class-timetable.service';
import { TimetableGridService } from './services/timetable-grid.service';
import { TimetablePublicationRepository } from './repositories/timetable-publication.repository';

@Module({
  imports: [
    RbacModule,
    AcademicYearModule,
    ClassModule,
    SectionModule,
    SubjectModule,
    EmployeeModule,
    SettingsModule,
  ],
  controllers: [PeriodController, ClassTimetableController],
  providers: [
    PeriodRepository,
    ClassTimetableRepository,
    PeriodService,
    ClassTimetableService,
    TimetablePublicationRepository,
    TimetableGridService,
  ],
  exports: [PeriodService, ClassTimetableService, TimetableGridService],
})
export class TimetableModule {}
