import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { StaffAttendance } from './entities/staff-attendance.entity';
import { StaffLeave } from './entities/staff-leave.entity';
import { Substitution } from './entities/substitution.entity';

export interface StaffRow {
  id: string;
  name: string;
  employeeNumber: string | null;
  designation: string | null;
}

@Injectable()
export class StaffAttendanceRepository extends BaseTenantRepository<StaffAttendance> {
  constructor(
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {
    super(ds, StaffAttendance, 'StaffAttendance');
  }

  sql<T>(query: string, params: unknown[]): Promise<T> {
    return this.ds.getManager().query<T>(query, [this.orgId, ...params]);
  }

  /** Active staff, by name. */
  async activeStaff(): Promise<StaffRow[]> {
    const rows = await this.sql<
      {
        id: string;
        name: string;
        employee_number: string | null;
        designation: string | null;
      }[]
    >(
      `SELECT e.id, concat_ws(' ', e.first_name, e.last_name) AS name,
              e.employee_number, d.title AS designation
         FROM employees e
         LEFT JOIN designations d ON d.id = e.designation_id
        WHERE e.org_id = $1 AND e.status = 'active' AND e.deleted_at IS NULL
        ORDER BY e.first_name, e.last_name`,
      [],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      employeeNumber: r.employee_number,
      designation: r.designation,
    }));
  }

  /** Saves the day's marks (insert or replace). */
  async upsert(
    date: string,
    marks: { employeeId: string; status: string }[],
    markedBy: string | null,
  ): Promise<void> {
    if (!marks.length) return;
    await this.sql(
      `INSERT INTO staff_attendance (org_id, employee_id, date, status, marked_by)
       SELECT $1, e, $2::date, s, $3 FROM unnest($4::uuid[], $5::text[]) AS x(e, s)
       ON CONFLICT (org_id, employee_id, date)
       DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, updated_at = now()`,
      [
        date,
        markedBy,
        marks.map((m) => m.employeeId),
        marks.map((m) => m.status),
      ],
    );
  }
}

@Injectable()
export class StaffLeaveRepository extends BaseTenantRepository<StaffLeave> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, StaffLeave, 'StaffLeave');
  }
}

@Injectable()
export class SubstitutionRepository extends BaseTenantRepository<Substitution> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Substitution, 'Substitution');
  }
}
