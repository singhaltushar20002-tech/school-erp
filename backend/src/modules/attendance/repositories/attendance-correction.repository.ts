import { Inject, Injectable } from '@nestjs/common';
import { DeepPartial, In } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { AttendanceCorrection } from '../entities/attendance-correction.entity';

@Injectable()
export class AttendanceCorrectionRepository extends BaseTenantRepository<AttendanceCorrection> {
  constructor(
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {
    super(ds, AttendanceCorrection, 'AttendanceCorrection');
  }

  async insertMany(rows: DeepPartial<AttendanceCorrection>[]): Promise<void> {
    if (rows.length) await this.repo.insert(rows);
  }

  /** A section's corrections for registers dated in a range, newest first. */
  async findInSection(
    sectionId: string,
    from: string,
    to: string,
  ): Promise<
    {
      id: string;
      date: string;
      studentName: string;
      rollNo: string | null;
      oldStatus: string;
      newStatus: string;
      reason: string;
      source: string;
      changedByName: string | null;
      changedAt: Date;
    }[]
  > {
    const rows = await this.ds.getManager().query<
      {
        id: string;
        date: string;
        student_name: string;
        roll_no: string | null;
        old_status: string;
        new_status: string;
        reason: string;
        source: string;
        changed_by_name: string | null;
        changed_at: Date;
      }[]
    >(
      `SELECT c."id", to_char(reg."date", 'YYYY-MM-DD') AS "date",
              concat_ws(' ', s."first_name", s."middle_name", s."last_name") AS "student_name",
              e."roll_no", c."old_status", c."new_status", c."reason", c."source",
              u."name" AS "changed_by_name", c."changed_at"
         FROM "attendance_corrections" c
         JOIN "attendance_records" rec ON rec."id" = c."record_id"
         JOIN "attendance_registers" reg ON reg."id" = rec."register_id"
         JOIN "student_enrollments" e ON e."id" = rec."enrollment_id"
         JOIN "students" s ON s."id" = e."student_id"
         LEFT JOIN "users" u ON u."id" = c."changed_by"
        WHERE c."org_id" = $1 AND reg."section_id" = $2
          AND reg."date" BETWEEN $3 AND $4
        ORDER BY c."changed_at" DESC`,
      [this.orgId, sectionId, from, to],
    );
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      studentName: r.student_name,
      rollNo: r.roll_no,
      oldStatus: r.old_status,
      newStatus: r.new_status,
      reason: r.reason,
      source: r.source,
      changedByName: r.changed_by_name,
      changedAt: r.changed_at,
    }));
  }

  /** The corrections of some records, oldest first. */
  findForRecords(recordIds: string[]): Promise<AttendanceCorrection[]> {
    if (!recordIds.length) return Promise.resolve([]);
    return this.repo.find({
      where: { recordId: In(recordIds) },
      order: { changedAt: 'ASC' },
    });
  }
}
