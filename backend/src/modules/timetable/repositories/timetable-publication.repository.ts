import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { TimetablePublication } from '../entities/timetable-publication.entity';

@Injectable()
export class TimetablePublicationRepository extends BaseTenantRepository<TimetablePublication> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, TimetablePublication, 'TimetablePublication');
  }

  findForSection(sectionId: string): Promise<TimetablePublication | null> {
    return this.repo.findOne({ where: { sectionId } });
  }
}
