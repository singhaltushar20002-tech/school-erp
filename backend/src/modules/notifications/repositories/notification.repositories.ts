import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import {
  DeliveryLog,
  Notification,
  NotificationTemplate,
} from '../entities/notification.entity';
import { DeepPartial, FindOptionsWhere } from 'typeorm';

@Injectable()
export class NotificationRepository extends BaseTenantRepository<Notification> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Notification, 'Notification');
  }

  async insertMany(rows: DeepPartial<Notification>[]): Promise<void> {
    if (rows.length) await this.repo.insert(rows as never);
  }

  async markRead(where: FindOptionsWhere<Notification>): Promise<number> {
    const result = await this.repo.update(where, { readAt: new Date() });
    return result.affected ?? 0;
  }
}

@Injectable()
export class NotificationTemplateRepository extends BaseTenantRepository<NotificationTemplate> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, NotificationTemplate, 'NotificationTemplate');
  }
}

@Injectable()
export class DeliveryLogRepository extends BaseTenantRepository<DeliveryLog> {
  constructor(
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {
    super(ds, DeliveryLog, 'DeliveryLog');
  }

  /** Names of the people a page of log rows went to, by user id. */
  async recipientNames(userIds: string[]): Promise<Map<string, string>> {
    if (!userIds.length) return new Map();
    const rows: { id: string; name: string | null; label: string | null }[] =
      await this.ds.getManager().query(
        `SELECT id, name, COALESCE(email, phone) AS label
           FROM users WHERE id = ANY($1)`,
        [userIds],
      );
    return new Map(rows.map((r) => [r.id, r.name ?? r.label ?? '']));
  }

  async insertMany(rows: DeepPartial<DeliveryLog>[]): Promise<DeliveryLog[]> {
    if (!rows.length) return [];
    return this.repo.save(rows.map((r) => this.repo.create(r)));
  }

  async updateFields(id: string, patch: Partial<DeliveryLog>): Promise<void> {
    await this.repo.update({ id }, patch);
  }
}
