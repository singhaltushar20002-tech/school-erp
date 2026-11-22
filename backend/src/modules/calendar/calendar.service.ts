import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ExamService } from '~/modules/exams/services/exam.service';
import {
  appliesToClass,
  HolidayService,
} from '~/modules/holidays/holiday.service';
import {
  CreateSchoolEventDto,
  UpdateSchoolEventDto,
} from './dto/school-event.dto';
import { SchoolEvent } from './entities/school-event.entity';
import { SchoolEventRepository } from './school-event.repository';

export interface CalendarItem {
  kind: 'holiday' | 'exam' | 'event';
  id: string;
  title: string;
  dateFrom: string;
  dateTo: string;
  /** For events: ptm, sports, … */
  eventKind: string | null;
  description: string | null;
  /** Events only: false when staff only. */
  forParents: boolean;
  classIds: string[];
}

const monthRange = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
  };
};

/**
 * The term calendar: holidays, exams and school events in one list, for
 * staff and (with staff-only events left out) for parents.
 */
@Injectable()
export class CalendarService {
  constructor(
    private readonly events: SchoolEventRepository,
    private readonly holidays: HolidayService,
    private readonly exams: ExamService,
    private readonly academicYears: AcademicYearService,
    private readonly context: RequestContext,
  ) {}

  /** A month of the calendar; `forParents` drops staff-only events. */
  async month(
    month: string,
    options: { classId?: string; forParents?: boolean } = {},
  ): Promise<{ month: string; items: CalendarItem[] }> {
    const { from, to } = monthRange(month);
    const { classId, forParents = false } = options;
    const holidays = (await this.holidays.findBetween(from, to))
      .filter((h) => !classId || appliesToClass(h, classId))
      .map((h): CalendarItem => ({
        kind: 'holiday',
        id: h.id,
        title: h.name,
        dateFrom: h.dateFrom,
        dateTo: h.dateTo,
        eventKind: null,
        description: null,
        forParents: true,
        classIds: h.classIds,
      }));
    const year = await this.academicYears.findCurrent();
    const exams = year
      ? (
          await this.exams.findFiltered({
            academicYearId: year.id,
            page: 1,
            limit: 100,
          })
        ).items
          .filter(
            (x) =>
              x.startDate &&
              x.startDate <= to &&
              (x.endDate ?? x.startDate) >= from,
          )
          .map((x): CalendarItem => ({
            kind: 'exam',
            id: x.id,
            title: x.name,
            dateFrom: x.startDate!,
            dateTo: x.endDate ?? x.startDate!,
            eventKind: null,
            description: null,
            forParents: true,
            classIds: [],
          }))
      : [];
    const events = (await this.events.findOverlapping(from, to))
      .filter(
        (e) =>
          (!forParents || e.forParents) &&
          (!classId || e.classIds.length === 0 || e.classIds.includes(classId)),
      )
      .map((e): CalendarItem => ({
        kind: 'event',
        id: e.id,
        title: e.title,
        dateFrom: e.dateFrom,
        dateTo: e.dateTo,
        eventKind: e.kind,
        description: e.description,
        forParents: e.forParents,
        classIds: e.classIds,
      }));
    return {
      month,
      items: [...holidays, ...exams, ...events].sort(
        (a, b) =>
          a.dateFrom.localeCompare(b.dateFrom) ||
          a.title.localeCompare(b.title),
      ),
    };
  }

  async findById(id: string): Promise<SchoolEvent> {
    const event = await this.events.findById(id);
    if (!event) throw new NotFoundException(`Event "${id}" not found`);
    return event;
  }

  create(dto: CreateSchoolEventDto): Promise<SchoolEvent> {
    const dateTo = dto.dateTo ?? dto.dateFrom;
    if (dateTo < dto.dateFrom) {
      throw new BadRequestException('The event ends before it starts');
    }
    return this.events.saveNew({
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      kind: dto.kind,
      dateFrom: dto.dateFrom,
      dateTo,
      classIds: dto.classIds ?? [],
      forParents: dto.forParents ?? true,
      createdBy: this.context.current().userId ?? null,
    });
  }

  async update(id: string, dto: UpdateSchoolEventDto): Promise<SchoolEvent> {
    const event = await this.findById(id);
    if (dto.title !== undefined) event.title = dto.title.trim();
    if (dto.description !== undefined)
      event.description = dto.description?.trim() || null;
    if (dto.kind !== undefined) event.kind = dto.kind;
    if (dto.dateFrom !== undefined) event.dateFrom = dto.dateFrom;
    if (dto.dateTo !== undefined) event.dateTo = dto.dateTo;
    if (event.dateTo < event.dateFrom) event.dateTo = event.dateFrom;
    if (dto.classIds !== undefined) event.classIds = dto.classIds;
    if (dto.forParents !== undefined) event.forParents = dto.forParents;
    return this.events.save(event);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.events.deleteById(id);
  }
}
