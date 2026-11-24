import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { In } from 'typeorm';
import { addDays } from '~/shared/dates/local-date';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import {
  AssignSubstituteDto,
  CreateStaffLeaveDto,
  MarkStaffDto,
} from './dto/staff-attendance.dto';
import type { StaffStatus } from './entities/staff-attendance.entity';
import type { LeaveStatus } from './entities/staff-leave.entity';
import {
  StaffAttendanceRepository,
  StaffLeaveRepository,
  SubstitutionRepository,
} from './staff.repositories';

const DAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;
const weekdayOf = (date: string) =>
  DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

const AWAY: StaffStatus[] = ['absent', 'leave', 'unpaid_leave'];

/** Loss-of-pay days a status costs. */
export const lopOf = (status: StaffStatus): number =>
  status === 'absent' || status === 'unpaid_leave'
    ? 1
    : status === 'half_day'
      ? 0.5
      : 0;

/**
 * The daily staff register, staff leave (approved leave marks the
 * register), and substitutes for absent teachers' periods.
 */
@Injectable()
export class StaffAttendanceService {
  constructor(
    private readonly attendance: StaffAttendanceRepository,
    private readonly leaves: StaffLeaveRepository,
    private readonly substitutions: SubstitutionRepository,
    private readonly settings: SettingsService,
    private readonly academicYears: AcademicYearService,
    private readonly context: RequestContext,
  ) {}

  private userId() {
    return this.context.current().userId ?? null;
  }

  /** Every active staff member with the day's mark (null: not marked). */
  async day(date?: string) {
    const day = date ?? (await this.settings.today());
    const staff = await this.attendance.activeStaff();
    const marks = new Map(
      (await this.attendance.find({ where: { date: day } })).map((m) => [
        m.employeeId,
        m.status,
      ]),
    );
    return {
      date: day,
      staff: staff.map((s) => ({ ...s, status: marks.get(s.id) ?? null })),
    };
  }

  async mark(dto: MarkStaffDto) {
    const today = await this.settings.today();
    if (dto.date > today) {
      throw new BadRequestException({
        message: "Attendance can't be marked for a future day",
        code: 'STAFF_ATTENDANCE_FUTURE',
      });
    }
    const active = new Set(
      (await this.attendance.activeStaff()).map((s) => s.id),
    );
    await this.attendance.upsert(
      dto.date,
      dto.records.filter((r) => active.has(r.employeeId)),
      this.userId(),
    );
    return this.day(dto.date);
  }

  /** Each staff member's month: counts by status and loss-of-pay days. */
  async month(month: string) {
    const [y, m] = month.split('-').map(Number);
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const from = `${month}-01`;
    const to = `${month}-${String(days).padStart(2, '0')}`;
    const rows = await this.attendance.sql<
      { employee_id: string; status: StaffStatus; n: string }[]
    >(
      `SELECT employee_id, status, count(*) AS n FROM staff_attendance
        WHERE org_id = $1 AND date BETWEEN $2 AND $3
        GROUP BY employee_id, status`,
      [from, to],
    );
    const staff = await this.attendance.activeStaff();
    return {
      month,
      daysInMonth: days,
      staff: staff.map((s) => {
        const mine = rows.filter((r) => r.employee_id === s.id);
        const count = (st: StaffStatus) =>
          Number(mine.find((r) => r.status === st)?.n ?? 0);
        return {
          ...s,
          present: count('present'),
          late: count('late'),
          halfDay: count('half_day'),
          absent: count('absent'),
          leave: count('leave'),
          unpaidLeave: count('unpaid_leave'),
          lopDays: mine.reduce((n, r) => n + lopOf(r.status) * Number(r.n), 0),
        };
      }),
    };
  }

  // --- Leave ---------------------------------------------------------------

  async listLeaves(status?: LeaveStatus) {
    const staff = new Map(
      (await this.attendance.activeStaff()).map((s) => [s.id, s]),
    );
    const rows = await this.leaves.find({
      where: status ? { status } : {},
      order: { fromDate: 'DESC', createdAt: 'DESC' },
      take: 300,
    });
    return rows.map((l) => ({
      ...l,
      employeeName: staff.get(l.employeeId)?.name ?? '',
      designation: staff.get(l.employeeId)?.designation ?? null,
    }));
  }

  async createLeave(dto: CreateStaffLeaveDto) {
    const toDate = dto.toDate ?? dto.fromDate;
    if (toDate < dto.fromDate) {
      throw new BadRequestException('The leave ends before it starts');
    }
    const staff = (await this.attendance.activeStaff()).find(
      (s) => s.id === dto.employeeId,
    );
    if (!staff) throw new NotFoundException('Staff member not found');
    const leave = await this.leaves.saveNew({
      employeeId: dto.employeeId,
      fromDate: dto.fromDate,
      toDate,
      leaveType: dto.leaveType,
      reason: dto.reason?.trim() || null,
      status: 'pending',
      requestedBy: this.userId(),
      decidedBy: null,
      decidedAt: null,
    });
    return dto.approved ? this.decide(leave.id, true) : leave;
  }

  async decide(id: string, approve: boolean) {
    const leave = await this.leaves.findById(id);
    if (!leave) throw new NotFoundException(`Leave "${id}" not found`);
    if (leave.status !== 'pending') {
      throw new BadRequestException({
        message: `The leave is already ${leave.status}`,
        code: 'LEAVE_DECIDED',
      });
    }
    leave.status = approve ? 'approved' : 'rejected';
    leave.decidedBy = this.userId();
    leave.decidedAt = new Date();
    await this.leaves.save(leave);
    if (approve) {
      // The register shows the leave on each school day it covers.
      const { weekendDays } = await this.settings.getSection('locale');
      const dates: string[] = [];
      for (let d = leave.fromDate; d <= leave.toDate; d = addDays(d, 1)) {
        if (!(weekendDays as string[]).includes(weekdayOf(d))) dates.push(d);
      }
      const status: StaffStatus =
        leave.leaveType === 'unpaid' ? 'unpaid_leave' : 'leave';
      for (const date of dates) {
        await this.attendance.upsert(
          date,
          [{ employeeId: leave.employeeId, status }],
          this.userId(),
        );
      }
    }
    return leave;
  }

  // --- Substitutes ---------------------------------------------------------

  /**
   * The day's periods of teachers who are away, each with its substitute
   * (if assigned) and the teachers free in that period.
   */
  async substitutionsFor(date?: string) {
    const day = date ?? (await this.settings.today());
    const year = await this.academicYears.findCurrent();
    if (!year) return { date: day, periods: [] };
    const weekday = weekdayOf(day);
    const away = (
      await this.attendance.find({ where: { date: day, status: In(AWAY) } })
    ).map((a) => a.employeeId);
    const all = await this.attendance.sql<
      {
        id: string;
        employee_id: string;
        period_id: string;
        period_name: string;
        start_time: string | null;
        display_order: number;
        section_name: string;
        class_name: string;
        class_level: number | null;
        subject_name: string;
        teacher_name: string;
        substitute_id: string | null;
      }[]
    >(
      `SELECT ct.id, ct.employee_id, ct.period_id, p.name AS period_name,
              to_char(p.start_time, 'HH24:MI') AS start_time, p.display_order,
              sec.name AS section_name, c.name AS class_name, c.level AS class_level,
              sub.name AS subject_name,
              concat_ws(' ', e.first_name, e.last_name) AS teacher_name,
              s.substitute_employee_id AS substitute_id
         FROM class_timetables ct
         JOIN periods p ON p.id = ct.period_id
         JOIN sections sec ON sec.id = ct.section_id
         JOIN classes c ON c.id = sec.class_id
         JOIN subjects sub ON sub.id = ct.subject_id
         JOIN employees e ON e.id = ct.employee_id
         LEFT JOIN substitutions s ON s.timetable_id = ct.id AND s.date = $2
        WHERE ct.org_id = $1 AND ct.academic_year_id = $3 AND ct.day_of_week = $4`,
      [day, year.id, weekday],
    );
    const staff = new Map(
      (await this.attendance.activeStaff()).map((s) => [s.id, s.name]),
    );
    const teachers = [...new Set(all.map((r) => r.employee_id))];
    const busy = new Map<string, Set<string>>();
    for (const r of all) {
      const set = busy.get(r.period_id) ?? new Set<string>();
      set.add(r.employee_id);
      if (r.substitute_id) set.add(r.substitute_id);
      busy.set(r.period_id, set);
    }
    const periods = all
      .filter((r) => away.includes(r.employee_id))
      .sort(
        (a, b) =>
          a.display_order - b.display_order ||
          (a.class_level ?? 0) - (b.class_level ?? 0) ||
          a.section_name.localeCompare(b.section_name),
      )
      .map((r) => ({
        timetableId: r.id,
        periodName: r.period_name,
        startTime: r.start_time,
        className: r.class_name,
        sectionName: r.section_name,
        subjectName: r.subject_name,
        teacherName: r.teacher_name,
        substitute: r.substitute_id
          ? { id: r.substitute_id, name: staff.get(r.substitute_id) ?? '' }
          : null,
        free: teachers
          .filter(
            (t) =>
              !away.includes(t) &&
              (!busy.get(r.period_id)?.has(t) || t === r.substitute_id),
          )
          .map((t) => ({ id: t, name: staff.get(t) ?? '' }))
          .filter((t) => t.name)
          .sort((a, b) => a.name.localeCompare(b.name)),
      }));
    return {
      date: day,
      absentTeachers: away.filter((a) => teachers.includes(a)).length,
      periods,
    };
  }

  async assignSubstitute(dto: AssignSubstituteDto) {
    const existing = await this.substitutions.findOne({
      where: { date: dto.date, timetableId: dto.timetableId },
    });
    if (!dto.employeeId) {
      if (existing) await this.substitutions.remove(existing);
    } else if (existing) {
      existing.substituteEmployeeId = dto.employeeId;
      existing.assignedBy = this.userId();
      await this.substitutions.save(existing);
    } else {
      await this.substitutions.saveNew({
        date: dto.date,
        timetableId: dto.timetableId,
        substituteEmployeeId: dto.employeeId,
        assignedBy: this.userId(),
      });
    }
    return this.substitutionsFor(dto.date);
  }
}
