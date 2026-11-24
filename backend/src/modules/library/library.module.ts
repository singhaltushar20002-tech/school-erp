import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { FeeModule } from '~/modules/fees/fee.module';
import { PlanModule } from '~/modules/plans/plan.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { StudentModule } from '~/modules/students/student.module';
import { LibraryController } from './library.controller';
import {
  LibraryBookRepository,
  LibraryCopyRepository,
  LibraryIssueRepository,
  LibraryService,
} from './library.service';

@Module({
  imports: [RbacModule, FeeModule, PlanModule, SettingsModule, StudentModule],
  controllers: [LibraryController],
  providers: [
    LibraryBookRepository,
    LibraryCopyRepository,
    LibraryIssueRepository,
    LibraryService,
  ],
  exports: [LibraryService],
})
export class LibraryModule {}
