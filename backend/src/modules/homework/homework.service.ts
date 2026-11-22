import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { addDays } from '~/shared/dates/local-date';
import { RequestContext } from '~/shared/request-context/request-context.service';
import type { SubjectAssignmentRef } from '~/modules/teaching/services/teaching.service';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassSubjectService } from '~/modules/class-curriculum/services/class-subject.service';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import { FileService, type IncomingFile } from '~/modules/files/file.service';
import { SectionService } from '~/modules/sections/section.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { CreateHomeworkDto } from './dto/homework.dto';
import { Homework } from './entities/homework.entity';
import {
  HomeworkRepository,
  HomeworkSubmissionRepository,
} from './homework.repository';

/** Which homework the caller may see or set (null = every one). */
export type HomeworkScope = SubjectAssignmentRef[] | null;

const allows = (
  scope: HomeworkScope,
  h: Pick<Homework, 'sectionId' | 'classSubjectId'>,
) =>
  scope === null ||
  scope.some(
    (a) => a.sectionId === h.sectionId && a.classSubjectId === h.classSubjectId,
  );

/**
 * Homework (set by subject teachers for a section, with an optional
 * attachment) and who has handed it in; parents see their child's in the
 * portal.
 */
@Injectable()
export class HomeworkService {
  constructor(
    private readonly homework: HomeworkRepository,
    private readonly submissions: HomeworkSubmissionRepository,
    private readonly sections: SectionService,
    private readonly classSubjects: ClassSubjectService,
    private readonly enrollments: EnrollmentService,
    private readonly files: FileService,
    private readonly settings: SettingsService,
    private readonly academicYears: AcademicYearService,
    private readonly context: RequestContext,
  ) {}

  private view(h: Homework, students?: number) {
    return {
      id: h.id,
      sectionId: h.sectionId,
      sectionName: h.section?.name ?? '',
      classId: h.section?.classId ?? null,
      className: h.section?.schoolClass?.name ?? '',
      classSubjectId: h.classSubjectId,
      subjectName: h.classSubject?.subject?.name ?? '',
      title: h.title,
      description: h.description,
      assignedOn: h.assignedOn,
      dueDate: h.dueDate,
      attachments: h.attachmentFileIds.length,
      submitted: h.submissions?.length ?? 0,
      students: students ?? null,
      createdAt: h.createdAt,
    };
  }

  async list(
    sectionId: string | undefined,
    from: string | undefined,
    scope: HomeworkScope,
  ) {
    const since = from ?? addDays(await this.settings.today(), -14);
    const sectionIds = sectionId
      ? [sectionId]
      : scope === null
        ? null
        : [...new Set(scope.map((a) => a.sectionId))];
    const rows = (await this.homework.findDueSince(since, sectionIds)).filter(
      (h) => allows(scope, h),
    );
    const counts = new Map<string, number>();
    for (const id of new Set(rows.map((h) => h.sectionId))) {
      counts.set(id, (await this.enrollments.findActiveInSection(id)).length);
    }
    return rows.map((h) => this.view(h, counts.get(h.sectionId)));
  }

  /** The sections and subjects the caller may set homework for. */
  async options(scope: HomeworkScope) {
    const section = scope?.[0]
      ? await this.sections.findById(scope[0].sectionId)
      : null;
    const yearId =
      section?.academicYearId ??
      (await this.academicYears.findCurrent())?.id ??
      null;
    if (!yearId) return [];
    return (await this.homework.sectionSubjects(yearId)).filter((o) =>
      allows(scope, o),
    );
  }

  private async find(id: string, scope: HomeworkScope): Promise<Homework> {
    const h = await this.homework.findFull(id);
    if (!h || !allows(scope, h)) {
      throw new NotFoundException(`Homework "${id}" not found`);
    }
    return h;
  }

  /** The homework with every student of the section and who handed it in. */
  async detail(id: string, scope: HomeworkScope) {
    const h = await this.find(id, scope);
    const students = await this.enrollments.findActiveInSection(h.sectionId);
    const handed = new Set((h.submissions ?? []).map((s) => s.enrollmentId));
    return {
      ...this.view(h, students.length),
      attachmentLinks: await this.attachmentLinks(h),
      roster: students.map((e) => ({
        enrollmentId: e.id,
        rollNo: e.rollNo,
        name: e.student?.fullName ?? '',
        submitted: handed.has(e.id),
      })),
    };
  }

  private async attachmentLinks(h: Homework) {
    const links: { fileId: string; name: string; url: string }[] = [];
    for (const fileId of h.attachmentFileIds) {
      const file = await this.files.findById(fileId).catch(() => null);
      if (!file) continue;
      links.push({
        fileId,
        name: file.originalName,
        url: await this.files.getDownloadUrl(fileId),
      });
    }
    return links;
  }

  async create(dto: CreateHomeworkDto) {
    const section = await this.sections.findById(dto.sectionId);
    const subject = await this.classSubjects.findById(dto.classSubjectId);
    if (
      subject.classId !== section.classId ||
      subject.academicYearId !== section.academicYearId
    ) {
      throw new BadRequestException({
        message: "That subject isn't taught in this section",
        code: 'HOMEWORK_SUBJECT_MISMATCH',
      });
    }
    const today = await this.settings.today();
    if (dto.dueDate < today) {
      throw new BadRequestException({
        message: 'The due date has already passed',
        code: 'HOMEWORK_DUE_PAST',
      });
    }
    for (const id of dto.attachmentFileIds ?? []) await this.files.findById(id);
    const saved = await this.homework.saveNew({
      sectionId: dto.sectionId,
      classSubjectId: dto.classSubjectId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      assignedOn: today,
      dueDate: dto.dueDate,
      attachmentFileIds: dto.attachmentFileIds ?? [],
      createdBy: this.context.current().userId ?? null,
    });
    return this.detail(saved.id, null);
  }

  async setSubmissions(
    id: string,
    enrollmentIds: string[],
    scope: HomeworkScope,
  ) {
    const h = await this.find(id, scope);
    const students = new Set(
      (await this.enrollments.findActiveInSection(h.sectionId)).map(
        (e) => e.id,
      ),
    );
    await this.submissions.replaceFor(
      id,
      [...new Set(enrollmentIds)].filter((e) => students.has(e)),
      this.context.current().userId ?? null,
    );
    return this.detail(id, scope);
  }

  async remove(id: string, scope: HomeworkScope) {
    const h = await this.find(id, scope);
    await this.homework.remove(h);
  }

  async uploadAttachment(file: IncomingFile): Promise<{ fileId: string }> {
    return { fileId: (await this.files.upload(file, 'attachment')).id };
  }

  /** A student's homework: the last two weeks and everything still due. */
  async forEnrollment(enrollmentId: string, sectionId: string) {
    const since = addDays(await this.settings.today(), -14);
    const rows = await this.homework.findDueSince(since, [sectionId]);
    return Promise.all(
      rows.map(async (h) => ({
        ...this.view(h),
        handedIn: (h.submissions ?? []).some(
          (s) => s.enrollmentId === enrollmentId,
        ),
        attachmentLinks: await this.attachmentLinks(h),
      })),
    );
  }
}
