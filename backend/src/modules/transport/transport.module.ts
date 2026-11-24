import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { FeeModule } from '~/modules/fees/fee.module';
import { PlanModule } from '~/modules/plans/plan.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { StudentModule } from '~/modules/students/student.module';
import { TransportController } from './transport.controller';
import {
  TransportAssignmentRepository,
  TransportRouteRepository,
  TransportService,
  TransportStopRepository,
} from './transport.service';

@Module({
  imports: [RbacModule, FeeModule, PlanModule, SettingsModule, StudentModule],
  controllers: [TransportController],
  providers: [
    TransportRouteRepository,
    TransportStopRepository,
    TransportAssignmentRepository,
    TransportService,
  ],
  exports: [TransportService],
})
export class TransportModule {}
