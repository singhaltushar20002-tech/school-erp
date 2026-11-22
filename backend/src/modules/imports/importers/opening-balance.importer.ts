import { Injectable } from '@nestjs/common';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import { InvoiceService } from '~/modules/fees/services/invoice.service';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { StudentService } from '~/modules/students/services/student.service';
import type {
  ParsedRow,
  RowError,
  SheetColumn,
} from '~/shared/spreadsheet/spreadsheet';
import { ImportType } from '../enums/import.enum';
import { addError, key, type Importer } from './importer';

export interface OpeningBalanceRow {
  studentId: string;
  amount: number;
  description?: string;
  dueDate?: string;
}

/** Rupees with up to two decimals, as minor units. */
const minor = (amount: number) => Math.round(amount * 100);

/**
 * Dues carried over from the school's old system: one ad hoc invoice per
 * student for the amount still owed, so it shows in dues, reminders and
 * the parent's fees page and can be collected like any other bill.
 */
@Injectable()
export class OpeningBalanceImporter implements Importer<OpeningBalanceRow> {
  readonly type = ImportType.OPENING_BALANCES;
  readonly permission = PERMISSIONS.FEES_BILL;

  constructor(
    private readonly students: StudentService,
    private readonly enrollments: EnrollmentService,
    private readonly academicYears: AcademicYearService,
    private readonly invoices: InvoiceService,
  ) {}

  columns(): Promise<SheetColumn<OpeningBalanceRow>[]> {
    return Promise.resolve([
      {
        key: 'studentId',
        header: 'Student ID',
        required: true,
        example: '26050001',
        width: 16,
      },
      {
        key: 'amount',
        header: 'Amount due',
        type: 'number',
        required: true,
        example: 4500,
        width: 14,
      },
      {
        key: 'description',
        header: 'Description',
        example: 'Balance carried from 2025–26',
        width: 32,
      },
      { key: 'dueDate', header: 'Due date', type: 'date', width: 14 },
    ]);
  }

  async validate(
    rows: ParsedRow<OpeningBalanceRow>[],
  ): Promise<Map<number, RowError[]>> {
    const errors = new Map<number, RowError[]>();
    const year = await this.academicYears.findCurrent();
    const seen = new Map<string, number>();
    for (const { row, values } of rows) {
      const id = String(values.studentId ?? '').trim();
      const amount = Number(values.amount);
      if (!(amount > 0) || minor(amount) > 1e12) {
        addError(
          errors,
          row,
          'Amount due',
          'INVALID_AMOUNT',
          'Enter an amount above 0',
        );
      }
      const dup = seen.get(key(id));
      if (dup) {
        addError(
          errors,
          row,
          'Student ID',
          'DUPLICATE_STUDENT',
          `Same student as row ${dup}`,
        );
      }
      seen.set(key(id), row);
      const student = id ? await this.students.findByAdmissionNumber(id) : null;
      if (!student) {
        addError(
          errors,
          row,
          'Student ID',
          'UNKNOWN_STUDENT',
          `No student with ID "${id}"`,
        );
        continue;
      }
      const enrolled = year
        ? await this.enrollments.findForStudentYear(student.id, year.id)
        : null;
      if (!enrolled) {
        addError(
          errors,
          row,
          'Student ID',
          'NOT_ENROLLED',
          'The student is not enrolled this session',
        );
      }
    }
    return errors;
  }

  async commitRow(values: OpeningBalanceRow): Promise<Record<string, unknown>> {
    const student = await this.students.findByAdmissionNumber(
      String(values.studentId).trim(),
    );
    const invoice = await this.invoices.create({
      studentId: student!.id,
      dueDate: values.dueDate,
      note: 'Opening balance (import)',
      lines: [
        {
          description: values.description?.trim() || 'Opening balance',
          amount: minor(Number(values.amount)),
        },
      ],
    });
    return { invoiceId: invoice.id };
  }
}
