import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { ClassModule } from '~/modules/classes/class.module';
import { StudentModule } from '~/modules/students/student.module';
import { EnquiryController } from './enquiry.controller';
import { EnquiryRepository } from './enquiry.repository';
import { EnquiryService } from './enquiry.service';

@Module({
  imports: [RbacModule, ClassModule, StudentModule],
  controllers: [EnquiryController],
  providers: [EnquiryRepository, EnquiryService],
})
export class EnquiryModule {}
