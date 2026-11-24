import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Enquiry } from './entities/enquiry.entity';

@Injectable()
export class EnquiryRepository extends BaseTenantRepository<Enquiry> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Enquiry, 'Enquiry');
  }

  /** Newest first (the list is the admissions desk's working queue). */
  findRecent(): Promise<Enquiry[]> {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: 1000 });
  }
}
