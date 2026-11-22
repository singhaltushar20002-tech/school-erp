import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { ExamModule } from '~/modules/exams/exam.module';
import { HolidayModule } from '~/modules/holidays/holiday.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { SchoolEventRepository } from './school-event.repository';

@Module({
  imports: [RbacModule, AcademicYearModule, ExamModule, HolidayModule],
  controllers: [CalendarController],
  providers: [SchoolEventRepository, CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
