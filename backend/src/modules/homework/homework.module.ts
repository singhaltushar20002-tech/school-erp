import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { AccessScopeModule } from '~/modules/access-scope/access-scope.module';
import { ClassCurriculumModule } from '~/modules/class-curriculum/class-curriculum.module';
import { EnrollmentModule } from '~/modules/enrollments/enrollment.module';
import { FileModule } from '~/modules/files/file.module';
import { SectionModule } from '~/modules/sections/section.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { HomeworkController } from './homework.controller';
import {
  HomeworkRepository,
  HomeworkSubmissionRepository,
} from './homework.repository';
import { HomeworkService } from './homework.service';

@Module({
  imports: [
    RbacModule,
    AcademicYearModule,
    AccessScopeModule,
    ClassCurriculumModule,
    EnrollmentModule,
    FileModule,
    SectionModule,
    SettingsModule,
  ],
  controllers: [HomeworkController],
  providers: [
    HomeworkRepository,
    HomeworkSubmissionRepository,
    HomeworkService,
  ],
  exports: [HomeworkService],
})
export class HomeworkModule {}
