import { Inject, Injectable } from '@nestjs/common';
import { CacheStore } from '~/shared/cache';
import { addDays } from '~/shared/dates/local-date';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import { AttendanceService } from '~/modules/attendance/services/attendance.service';
import { AttendanceReportService } from '~/modules/attendance/services/attendance-report.service';
import { ClassService } from '~/modules/classes/class.service';
import { EmployeeService } from '~/modules/employees/employee.service';
import { EmployeeStatus } from '~/modules/employees/enums/employee-status.enum';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import { ExamService } from '~/modules/exams/services/exam.service';
import { MarkSheetService } from '~/modules/exams/services/mark-sheet.service';
import { FeeReportService } from '~/modules/fees/services/fee-report.service';
import { PaymentService } from '~/modules/fees/services/payment.service';
import { HolidayService } from '~/modules/holidays/holiday.service';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { SettingsService } from '~/modules/settings/services/settings.service';

/** How long a dashboard is served from the cache. */
export const DASHBOARD_TTL_SECONDS = 60;

/**
 * Role dashboards (PRD 6.22): built from the feature modules' own reports
 * so the numbers match them, and cached for 60 seconds per school (per
 * user for the teacher's).
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly cache: CacheStore,
    private readonly scope: AccessScope,
    private readonly academicYears: AcademicYearService,
    private readonly classes: ClassService,
    private readonly enrollments: EnrollmentService,
    private readonly employees: EmployeeService,
    private readonly attendance: AttendanceReportService,
    private readonly registers: AttendanceService,
    private readonly holidays: HolidayService,
    private readonly exams: ExamService,
    private readonly sheets: MarkSheetService,
    private readonly feeReports: FeeReportService,
    private readonly payments: PaymentService,
    private readonly settings: SettingsService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /** Enrollment, attendance today, collection, dues, staff, upcoming events. */
  admin() {
    return this.cache.wrap(
      `dash:admin:${this.ds.orgId}`,
      DASHBOARD_TTL_SECONDS,
      async () => {
        const today = await this.settings.today();
        const year = await this.academicYears.findCurrent();
        const counts = year
          ? await this.enrollments.countActiveByClass(year.id)
          : [];
        const byClass = new Map(counts.map((c) => [c.classId, c.students]));
        const classes = await this.classes.findAllOrdered();
        const daily = year
          ? await this.attendance.daily({ date: today }, null)
          : null;
        const staff = await this.employees.findFiltered({
          status: EmployeeStatus.ACTIVE,
          page: 1,
          limit: 1,
        });
        return {
          date: today,
          enrollment: {
            total: counts.reduce((n, c) => n + c.students, 0),
            // In class order, classes without students left out.
            byClass: classes
              .filter((c) => byClass.has(c.id))
              .map((c) => ({
                classId: c.id,
                className: c.name,
                students: byClass.get(c.id)!,
              })),
          },
          attendanceToday: daily
            ? {
                ...daily.school,
                byClass: daily.classes.map((c) => ({
                  classId: c.classId,
                  className: c.className,
                  percentage: c.percentage,
                  submitted: c.submitted,
                  sections: c.sections.length,
                })),
              }
            : null,
          collection: {
            today: await this.feeReports.collectionBetween(today, today),
            monthToDate: await this.feeReports.collectionBetween(
              `${today.slice(0, 7)}-01`,
              today,
            ),
          },
          dues: (await this.feeReports.dues({ asOf: today }, null)).totals,
          defaulters: await this.defaulterCounts(today),
          absentToday: await this.absentees(today),
          admissions: await this.newAdmissions(addDays(today, -6), today),
          staff: { active: staff.meta.total },
          upcoming: await this.upcoming(today, year?.id ?? null),
        };
      },
    );
  }

  /** Students with anything overdue, and those over 60 days. */
  private async defaulterCounts(today: string) {
    const { students } = await this.feeReports.dues({ asOf: today }, null);
    const overdue = students.filter((s) => s.overdue > 0);
    return {
      students: overdue.length,
      over60: overdue.filter((s) => s.oldestDueDate < addDays(today, -60))
        .length,
    };
  }

  /** Who is marked absent today (any status that counts as absent). */
  private async absentees(today: string) {
    const rows = await this.ds.getManager().query<
      {
        student_id: string;
        name: string;
        admission_number: string;
        class_name: string;
        section_name: string;
        roll_no: string | null;
      }[]
    >(
      `SELECT DISTINCT ON (s."id", c."level", sec."name", e."roll_no")
              s."id" AS "student_id",
              concat_ws(' ', s."first_name", s."middle_name", s."last_name") AS "name",
              s."admission_number", c."name" AS "class_name",
              sec."name" AS "section_name", e."roll_no"
         FROM "attendance_records" rec
         JOIN "attendance_registers" reg ON reg."id" = rec."register_id"
         JOIN "student_enrollments" e ON e."id" = rec."enrollment_id"
         JOIN "students" s ON s."id" = e."student_id"
         JOIN "sections" sec ON sec."id" = reg."section_id"
         JOIN "classes" c ON c."id" = sec."class_id"
        WHERE rec."org_id" = $1 AND reg."date" = $2
          AND (rec."status_code" = 'absent' OR rec."status_code" IN (
                SELECT "code" FROM "attendance_statuses"
                 WHERE "org_id" = $1 AND "counts_as" = 'absent'))
        ORDER BY c."level", sec."name", e."roll_no", s."id"`,
      [this.ds.orgId, today],
    );
    return {
      count: rows.length,
      students: rows.slice(0, 50).map((r) => ({
        studentId: r.student_id,
        name: r.name,
        admissionNumber: r.admission_number,
        className: r.class_name,
        sectionName: r.section_name,
        rollNo: r.roll_no,
      })),
    };
  }

  /** Students admitted between two days (inclusive), newest first. */
  private async newAdmissions(from: string, to: string) {
    const rows = await this.ds.getManager().query<
      {
        id: string;
        name: string;
        admission_date: string;
        class_name: string | null;
        section_name: string | null;
      }[]
    >(
      `SELECT s."id",
              concat_ws(' ', s."first_name", s."middle_name", s."last_name") AS "name",
              to_char(s."admission_date", 'YYYY-MM-DD') AS "admission_date",
              c."name" AS "class_name", sec."name" AS "section_name"
         FROM "students" s
         LEFT JOIN "student_enrollments" e
           ON e."student_id" = s."id" AND e."status" = 'active'
         LEFT JOIN "sections" sec ON sec."id" = e."section_id"
         LEFT JOIN "classes" c ON c."id" = sec."class_id"
        WHERE s."org_id" = $1 AND s."deleted_at" IS NULL
          AND s."admission_date" BETWEEN $2 AND $3
        ORDER BY s."admission_date" DESC, s."created_at" DESC`,
      [this.ds.orgId, from, to],
    );
    return {
      from,
      count: rows.length,
      students: rows.slice(0, 20).map((r) => ({
        studentId: r.id,
        name: r.name,
        admissionDate: r.admission_date,
        className: r.class_name,
        sectionName: r.section_name,
      })),
    };
  }

  /** Today's sections and their registers, and the marks still to enter. */
  async teacher(userId: string) {
    return this.cache.wrap(
      `dash:teacher:${this.ds.orgId}:${userId}`,
      DASHBOARD_TTL_SECONDS,
      async () => {
        const today = await this.settings.today();
        const sections = await this.scope.sections(PERMISSIONS.ATTENDANCE_TAKE);
        const status = await this.attendanceStatus(today, sections);
        const pendingMarks = await this.sheets.pendingFor(
          await this.scope.subjectAssignments(PERMISSIONS.RESULTS_ENTER),
        );
        return {
          date: today,
          sections: status?.rows ?? [],
          pendingAttendance: (status?.rows ?? []).filter(
            (r) => r.status === 'pending',
          ).length,
          pendingMarkSheets: pendingMarks,
        };
      },
    );
  }

  /** Collection, dues and expenses. */
  accountant() {
    return this.cache.wrap(
      `dash:accountant:${this.ds.orgId}`,
      DASHBOARD_TTL_SECONDS,
      async () => {
        const today = await this.settings.today();
        const monthStart = `${today.slice(0, 7)}-01`;
        const recent = await this.payments.findPayments({ page: 1, limit: 10 });
        return {
          date: today,
          collection: {
            today: await this.feeReports.collectionBetween(today, today),
            monthToDate: await this.feeReports.collectionBetween(
              monthStart,
              today,
            ),
          },
          dues: (await this.feeReports.dues({ asOf: today }, null)).totals,
          expenses: {
            monthToDate: await this.feeReports.expensesBetween(
              monthStart,
              today,
            ),
          },
          recentPayments: recent.items.map((p) => ({
            id: p.id,
            amount: p.amount,
            channel: p.channel,
            status: p.status,
            receivedAt: p.receivedAt,
            payer: p.student?.fullName ?? p.payerGuardian?.name ?? '',
          })),
        };
      },
    );
  }

  /** Sections of the session and whether today's register is in. */
  private async attendanceStatus(today: string, sections: string[] | null) {
    if (!(await this.academicYears.findCurrent())) return null;
    return this.registers.submissionStatus({ date: today }, sections);
  }

  /** Holidays and exams in the next 30 days. */
  private async upcoming(today: string, yearId: string | null) {
    const until = addDays(today, 30);
    const holidays = (await this.holidays.findBetween(today, until)).map(
      (h) => ({
        kind: 'holiday' as const,
        title: h.name,
        date: h.dateFrom < today ? today : h.dateFrom,
        endDate: h.dateTo,
      }),
    );
    const exams = yearId
      ? (
          await this.exams.findFiltered({
            academicYearId: yearId,
            page: 1,
            limit: 100,
          })
        ).items
          .filter(
            (x) => x.startDate && x.startDate >= today && x.startDate <= until,
          )
          .map((x) => ({
            kind: 'exam' as const,
            title: x.name,
            date: x.startDate!,
            endDate: x.endDate,
          }))
      : [];
    return [...holidays, ...exams].sort((a, b) => a.date.localeCompare(b.date));
  }
}
