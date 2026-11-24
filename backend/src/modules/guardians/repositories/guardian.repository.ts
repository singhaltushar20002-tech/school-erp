import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsWhere, IsNull, Not } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Guardian } from '../entities/guardian.entity';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '~/common/dto/pagination-query.dto';
import type { FilterGuardianDto } from '../dto/filter-guardian.dto';
import { Paginated } from '~/common/dto/paginated.dto';

/** A student linked to a guardian, for the guardians list. */
export interface GuardianChild {
  guardianId: string;
  relation: string;
  isPrimary: boolean;
  studentId: string;
  admissionNumber: string;
  name: string;
  status: string;
  className: string | null;
  sectionName: string | null;
}

@Injectable()
export class GuardianRepository extends BaseTenantRepository<Guardian> {
  constructor(
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {
    super(ds, Guardian, 'Guardian');
  }

  /**
   * The staff directory's search: `q` matches part of the name or the
   * phone's digits; `sectionIds` limits it to a teacher's students.
   */
  async search(
    filter: FilterGuardianDto,
    sectionIds: string[] | null,
  ): Promise<Paginated<Guardian>> {
    const { page = 1, limit = DEFAULT_PAGE_SIZE } = filter;
    if (sectionIds && !sectionIds.length)
      return new Paginated<Guardian>([], 0, { page, limit });
    const qb = this.repo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.user', 'user')
      .where('g.org_id = :orgId', { orgId: this.orgId });
    if (sectionIds) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM "student_guardians" sg
          JOIN "student_enrollments" e ON e.student_id = sg.student_id
          WHERE sg.guardian_id = g.id AND sg.org_id = :orgId
            AND e.org_id = :orgId AND e.section_id IN (:...sectionIds))`,
        { sectionIds },
      );
    }
    const q = filter.q?.trim();
    if (q) {
      const digits = q.replace(/\D/g, '');
      qb.andWhere(
        digits.length >= 3
          ? '(g.name ILIKE :q OR g.phone LIKE :digits)'
          : 'g.name ILIKE :q',
        { q: `%${q.replace(/[%_\\]/g, '\\$&')}%`, digits: `%${digits}%` },
      );
    }
    if (filter.portal === 'yes') qb.andWhere('g.user_id IS NOT NULL');
    if (filter.portal === 'no') qb.andWhere('g.user_id IS NULL');
    const [items, total] = await qb
      .orderBy('g.name', 'ASC')
      .addOrderBy('g.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return new Paginated(items, total, { page, limit });
  }

  /** Each guardian's children, with this session's class and section. */
  async childrenOf(guardianIds: string[]): Promise<GuardianChild[]> {
    if (!guardianIds.length) return [];
    return this.ds.getManager().query(
      `SELECT sg.guardian_id AS "guardianId", sg.relation, sg.is_primary AS "isPrimary",
              s.id AS "studentId", s.admission_number AS "admissionNumber",
              concat_ws(' ', s.first_name, s.middle_name, s.last_name) AS "name",
              s.status, c.name AS "className", sec.name AS "sectionName"
         FROM student_guardians sg
         JOIN students s ON s.id = sg.student_id AND s.deleted_at IS NULL
         LEFT JOIN student_enrollments e ON e.student_id = s.id
          AND e.academic_year_id = (SELECT id FROM academic_years
            WHERE org_id = $1 AND is_current AND deleted_at IS NULL LIMIT 1)
         LEFT JOIN classes c ON c.id = e.class_id
         LEFT JOIN sections sec ON sec.id = e.section_id
        WHERE sg.org_id = $1 AND sg.guardian_id = ANY($2)
        ORDER BY c.level NULLS LAST, s.first_name`,
      [this.orgId, guardianIds],
    );
  }

  findByIdWithUser(id: string): Promise<Guardian | null> {
    return this.repo.findOne({ where: { id }, relations: { user: true } });
  }

  /**
   * Guardians of students enrolled in the sections (scoped teachers).
   * Reads the link and enrollment tables by name, read-only.
   */
  async findInSections(
    filter: FilterGuardianDto,
    sectionIds: string[],
  ): Promise<Paginated<Guardian>> {
    const { page = 1, limit = DEFAULT_PAGE_SIZE } = filter;
    if (!sectionIds.length)
      return new Paginated<Guardian>([], 0, { page, limit });
    const qb = this.repo
      .createQueryBuilder('g')
      .where('g.org_id = :orgId', { orgId: this.orgId })
      .andWhere(
        `EXISTS (SELECT 1 FROM "student_guardians" sg
          JOIN "student_enrollments" e ON e.student_id = sg.student_id
          WHERE sg.guardian_id = g.id AND sg.org_id = :orgId
            AND e.org_id = :orgId AND e.section_id IN (:...sectionIds))`,
        { sectionIds },
      );
    if (filter.id) qb.andWhere('g.id = :id', { id: filter.id });
    if (filter.name) qb.andWhere('g.name = :name', { name: filter.name });
    const [items, total] = await qb
      .orderBy('g.created_at', 'DESC')
      .addOrderBy('g.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return new Paginated(items, total, { page, limit });
  }

  findByPhone(phone: string): Promise<Guardian | null> {
    return this.repo.findOne({ where: { phone } });
  }

  /** Writes columns only. */
  async updateFields(
    id: string,
    patch: Partial<Omit<Guardian, 'user' | 'links'>>,
  ): Promise<void> {
    if (Object.values(patch).every((v) => v === undefined)) return;
    await this.repo.update({ id }, patch);
  }

  async userIds(): Promise<string[]> {
    const rows = await this.repo.find({
      where: { userId: Not(IsNull()) },
      select: { id: true, userId: true },
    });
    return rows.map((r) => r.userId!);
  }

  findByUserId(userId: string): Promise<Guardian | null> {
    return this.repo.findOne({ where: { userId } });
  }

  findFiltered(
    where: FindOptionsWhere<Guardian>,
    page: PaginationQueryDto,
  ): Promise<Paginated<Guardian>> {
    return this.findPage(
      {
        where,
        relations: { user: true },
        order: { createdAt: 'DESC' },
      },
      page,
    );
  }
}
