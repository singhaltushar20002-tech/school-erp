import { Inject, Injectable } from '@nestjs/common';
import { LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { SchoolEvent } from './entities/school-event.entity';

@Injectable()
export class SchoolEventRepository extends BaseTenantRepository<SchoolEvent> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, SchoolEvent, 'SchoolEvent');
  }

  /** Events overlapping `[from, to]` (inclusive), earliest first. */
  findOverlapping(from: string, to: string): Promise<SchoolEvent[]> {
    return this.repo.find({
      where: { dateFrom: LessThanOrEqual(to), dateTo: MoreThanOrEqual(from) },
      order: { dateFrom: 'ASC', title: 'ASC' },
    });
  }
}
