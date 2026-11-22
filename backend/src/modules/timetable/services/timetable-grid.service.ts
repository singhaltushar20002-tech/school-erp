import { Injectable } from '@nestjs/common';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { SectionService } from '~/modules/sections/section.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { ClassTimetableRepository } from '../repositories/class-timetable.repository';
import { PeriodRepository } from '../repositories/period.repository';
import { TimetablePublicationRepository } from '../repositories/timetable-publication.repository';

const WEEK: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

export interface TimetableGrid {
  section: {
    id: string;
    name: string;
    classId: string;
    className: string;
    academicYearId: string;
  };
  /** School days, Monday first (the school's weekend left out). */
  days: DayOfWeek[];
  periods: {
    id: string;
    name: string;
    startTime: string | null;
    endTime: string | null;
  }[];
  slots: {
    id: string;
    dayOfWeek: DayOfWeek;
    periodId: string;
    subjectId: string;
    subjectName: string;
    employeeId: string;
    teacherName: string;
  }[];
  published: { at: Date } | null;
}

/**
 * A section's week as a grid (days × periods), and publishing it to
 * parents and students.
 */
@Injectable()
export class TimetableGridService {
  constructor(
    private readonly slots: ClassTimetableRepository,
    private readonly periods: PeriodRepository,
    private readonly publications: TimetablePublicationRepository,
    private readonly sections: SectionService,
    private readonly settings: SettingsService,
    private readonly context: RequestContext,
  ) {}

  async grid(sectionId: string): Promise<TimetableGrid> {
    const section = await this.sections.findById(sectionId);
    const { weekendDays } = await this.settings.getSection('locale');
    const periods = (
      await this.periods.find({
        where: { isActive: true },
        order: { displayOrder: 'ASC', startTime: 'ASC' },
      })
    ).map((p) => ({
      id: p.id,
      name: p.name,
      startTime: p.startTime?.slice(0, 5) ?? null,
      endTime: p.endTime?.slice(0, 5) ?? null,
    }));
    const rows = await this.slots.find({
      where: { sectionId, academicYearId: section.academicYearId },
      relations: { subject: true, employee: true },
    });
    const published = await this.publications.findForSection(sectionId);
    return {
      section: {
        id: section.id,
        name: section.name,
        classId: section.classId,
        className: section.schoolClass?.name ?? '',
        academicYearId: section.academicYearId,
      },
      days: WEEK.filter(
        (d) => !(weekendDays as string[]).includes(d as string),
      ),
      periods,
      slots: rows.map((r) => ({
        id: r.id,
        dayOfWeek: r.dayOfWeek,
        periodId: r.periodId,
        subjectId: r.subjectId,
        subjectName: r.subject?.name ?? '',
        employeeId: r.employeeId,
        teacherName: r.employee?.fullName ?? '',
      })),
      published: published ? { at: published.publishedAt } : null,
    };
  }

  /** The grid for parents: only once published. */
  async publishedGrid(sectionId: string): Promise<TimetableGrid | null> {
    const published = await this.publications.findForSection(sectionId);
    return published ? this.grid(sectionId) : null;
  }

  async publish(sectionId: string): Promise<TimetableGrid> {
    await this.sections.findById(sectionId);
    const existing = await this.publications.findForSection(sectionId);
    if (existing) {
      existing.publishedAt = new Date();
      existing.publishedBy = this.context.current().userId ?? null;
      await this.publications.save(existing);
    } else {
      await this.publications.saveNew({
        sectionId,
        publishedAt: new Date(),
        publishedBy: this.context.current().userId ?? null,
      });
    }
    return this.grid(sectionId);
  }

  async unpublish(sectionId: string): Promise<TimetableGrid> {
    const existing = await this.publications.findForSection(sectionId);
    if (existing) await this.publications.remove(existing);
    return this.grid(sectionId);
  }
}
