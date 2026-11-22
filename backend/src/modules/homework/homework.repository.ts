import { Inject, Injectable } from '@nestjs/common';
import { In, MoreThanOrEqual } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Homework } from './entities/homework.entity';
import { HomeworkSubmission } from './entities/homework-submission.entity';

@Injectable()
export class HomeworkRepository extends BaseTenantRepository<Homework> {
  constructor(
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {
    super(ds, Homework, 'Homework');
  }

  /** Every section × class subject of a session, with names, in class order. */
  async sectionSubjects(academicYearId: string): Promise<
    {
      sectionId: string;
      sectionName: string;
      className: string;
      classSubjectId: string;
      subjectName: string;
    }[]
  > {
    const rows = await this.ds.getManager().query<
      {
        section_id: string;
        section_name: string;
        class_name: string;
        class_subject_id: string;
        subject_name: string;
      }[]
    >(
      `SELECT sec."id" AS "section_id", sec."name" AS "section_name",
              c."name" AS "class_name", cs."id" AS "class_subject_id",
              sub."name" AS "subject_name"
         FROM "sections" sec
         JOIN "classes" c ON c."id" = sec."class_id"
         JOIN "class_subjects" cs
           ON cs."class_id" = sec."class_id"
          AND cs."academic_year_id" = sec."academic_year_id"
         JOIN "subjects" sub ON sub."id" = cs."subject_id"
        WHERE sec."org_id" = $1 AND sec."academic_year_id" = $2
        ORDER BY c."level", sec."name", sub."name"`,
      [this.orgId, academicYearId],
    );
    return rows.map((r) => ({
      sectionId: r.section_id,
      sectionName: r.section_name,
      className: r.class_name,
      classSubjectId: r.class_subject_id,
      subjectName: r.subject_name,
    }));
  }

  /** Due on or after `from`, in these sections (null = all), latest due first. */
  findDueSince(from: string, sectionIds: string[] | null): Promise<Homework[]> {
    return this.repo.find({
      where: {
        dueDate: MoreThanOrEqual(from),
        ...(sectionIds ? { sectionId: In(sectionIds) } : {}),
      },
      relations: {
        section: { schoolClass: true },
        classSubject: { subject: true },
        submissions: true,
      },
      order: { dueDate: 'DESC', createdAt: 'DESC' },
      take: 300,
    });
  }

  findFull(id: string): Promise<Homework | null> {
    return this.repo.findOne({
      where: { id },
      relations: {
        section: { schoolClass: true },
        classSubject: { subject: true },
        submissions: true,
      },
    });
  }
}

@Injectable()
export class HomeworkSubmissionRepository extends BaseTenantRepository<HomeworkSubmission> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, HomeworkSubmission, 'HomeworkSubmission');
  }

  async replaceFor(
    homeworkId: string,
    enrollmentIds: string[],
    markedBy: string | null,
  ): Promise<void> {
    const existing = await this.repo.find({ where: { homeworkId } });
    const keep = new Set(enrollmentIds);
    const gone = existing.filter((s) => !keep.has(s.enrollmentId));
    if (gone.length) await this.repo.delete({ id: In(gone.map((s) => s.id)) });
    const have = new Set(existing.map((s) => s.enrollmentId));
    const add = enrollmentIds.filter((id) => !have.has(id));
    if (add.length) {
      await this.repo.insert(
        add.map((enrollmentId) => ({
          homeworkId,
          enrollmentId,
          markedBy,
          markedAt: new Date(),
        })),
      );
    }
  }
}
