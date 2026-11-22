import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IsNull } from 'typeorm';
import { addDays } from '~/shared/dates/local-date';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { InvoiceService } from '~/modules/fees/services/invoice.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { StudentService } from '~/modules/students/services/student.service';
import { CreateBookDto, IssueDto } from './library.dto';
import {
  LibraryBook,
  LibraryCopy,
  LibraryIssue,
} from './entities/library.entity';

/** Late fine per day, in minor units (₹2). */
export const FINE_PER_DAY = 200;
const LOAN_DAYS = 14;

@Injectable()
export class LibraryBookRepository extends BaseTenantRepository<LibraryBook> {
  constructor(
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {
    super(ds, LibraryBook, 'LibraryBook');
  }

  sql<T>(query: string, params: unknown[]): Promise<T> {
    return this.ds.getManager().query<T>(query, [this.orgId, ...params]);
  }
}

@Injectable()
export class LibraryCopyRepository extends BaseTenantRepository<LibraryCopy> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, LibraryCopy, 'LibraryCopy');
  }
}

@Injectable()
export class LibraryIssueRepository extends BaseTenantRepository<LibraryIssue> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, LibraryIssue, 'LibraryIssue');
  }
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/**
 * The library: catalogue and copies, issue and return at the desk, and
 * late fines billed to the student's fees.
 */
@Injectable()
export class LibraryService {
  constructor(
    private readonly books: LibraryBookRepository,
    private readonly copies: LibraryCopyRepository,
    private readonly issues: LibraryIssueRepository,
    private readonly students: StudentService,
    private readonly invoices: InvoiceService,
    private readonly settings: SettingsService,
    private readonly context: RequestContext,
  ) {}

  async listBooks(q?: string) {
    const rows = await this.books.sql<
      {
        id: string;
        title: string;
        author: string | null;
        isbn: string | null;
        category: string | null;
        publisher: string | null;
        total: string;
        available: string;
        accessions: string[];
      }[]
    >(
      `SELECT b.id, b.title, b.author, b.isbn, b.category, b.publisher,
              count(c.id) AS total,
              count(c.id) FILTER (WHERE c.status = 'available') AS available,
              coalesce(array_agg(c.accession_no ORDER BY c.accession_no)
                FILTER (WHERE c.id IS NOT NULL), '{}') AS accessions
         FROM library_books b
         LEFT JOIN library_copies c ON c.book_id = b.id
        WHERE b.org_id = $1
          AND ($2::text IS NULL OR b.title ILIKE '%' || $2 || '%'
               OR b.author ILIKE '%' || $2 || '%' OR b.isbn = $2)
        GROUP BY b.id
        ORDER BY b.title
        LIMIT 500`,
      [q?.trim() || null],
    );
    return rows.map((r) => ({
      ...r,
      total: Number(r.total),
      available: Number(r.available),
    }));
  }

  /** The next accession numbers (LIB-00001…). */
  private async nextAccessions(count: number): Promise<string[]> {
    const [row] = await this.books.sql<{ n: string | null }[]>(
      `SELECT max(substring(accession_no from '[0-9]+')::int) AS n
         FROM library_copies WHERE org_id = $1`,
      [],
    );
    const start = Number(row?.n ?? 0) + 1;
    return Array.from(
      { length: count },
      (_, i) => `LIB-${String(start + i).padStart(5, '0')}`,
    );
  }

  async addBook(dto: CreateBookDto) {
    const book = await this.books.saveNew({
      title: dto.title.trim(),
      author: dto.author?.trim() || null,
      isbn: dto.isbn?.trim() || null,
      category: dto.category?.trim() || null,
      publisher: dto.publisher?.trim() || null,
    });
    await this.addCopies(book.id, dto.copies ?? 1);
    return (await this.listBooks()).find((b) => b.id === book.id);
  }

  async addCopies(bookId: string, count: number) {
    const book = await this.books.findById(bookId);
    if (!book) throw new NotFoundException('Book not found');
    for (const accessionNo of await this.nextAccessions(count)) {
      await this.copies.saveNew({ bookId, accessionNo, status: 'available' });
    }
    return (await this.listBooks()).find((b) => b.id === bookId);
  }

  async listIssues(status: 'out' | 'overdue' | 'returned' = 'out') {
    const today = await this.settings.today();
    const rows = await this.books.sql<
      {
        id: string;
        accession_no: string;
        title: string;
        author: string | null;
        student_id: string;
        student_name: string;
        admission_number: string;
        class_name: string | null;
        section_name: string | null;
        issued_on: string;
        due_on: string;
        returned_on: string | null;
        fine: string;
      }[]
    >(
      `SELECT i.id, c.accession_no, b.title, b.author, s.id AS student_id,
              concat_ws(' ', s.first_name, s.middle_name, s.last_name) AS student_name,
              s.admission_number, cl.name AS class_name, sec.name AS section_name,
              to_char(i.issued_on, 'YYYY-MM-DD') AS issued_on,
              to_char(i.due_on, 'YYYY-MM-DD') AS due_on,
              to_char(i.returned_on, 'YYYY-MM-DD') AS returned_on, i.fine
         FROM library_issues i
         JOIN library_copies c ON c.id = i.copy_id
         JOIN library_books b ON b.id = c.book_id
         JOIN students s ON s.id = i.student_id
         LEFT JOIN student_enrollments e ON e.student_id = s.id AND e.status = 'active'
         LEFT JOIN sections sec ON sec.id = e.section_id
         LEFT JOIN classes cl ON cl.id = sec.class_id
        WHERE i.org_id = $1
          AND CASE $2::text
                WHEN 'returned' THEN i.returned_on IS NOT NULL
                WHEN 'overdue' THEN i.returned_on IS NULL AND i.due_on < $3::date
                ELSE i.returned_on IS NULL END
        ORDER BY CASE WHEN $2::text = 'returned' THEN i.returned_on END DESC NULLS LAST,
                 i.due_on
        LIMIT 500`,
      [status, today],
    );
    return rows.map((r) => ({
      id: r.id,
      accessionNo: r.accession_no,
      title: r.title,
      author: r.author,
      studentId: r.student_id,
      studentName: r.student_name,
      admissionNumber: r.admission_number,
      className: r.class_name,
      sectionName: r.section_name,
      issuedOn: r.issued_on,
      dueOn: r.due_on,
      returnedOn: r.returned_on,
      daysOverdue: r.returned_on
        ? 0
        : Math.max(0, daysBetween(r.due_on, today)),
      fine: Number(r.fine),
    }));
  }

  async issue(dto: IssueDto) {
    const copy = await this.copies.findOne({
      where: { accessionNo: dto.accessionNo.trim().toUpperCase() },
      relations: { book: true },
    });
    if (!copy) {
      throw new NotFoundException({
        message: `No copy with accession number "${dto.accessionNo}"`,
        code: 'COPY_NOT_FOUND',
      });
    }
    if (copy.status !== 'available') {
      throw new BadRequestException({
        message: `That copy is ${copy.status}`,
        code: 'COPY_NOT_AVAILABLE',
      });
    }
    const student = await this.students.findByAdmissionNumber(
      dto.studentId.trim(),
    );
    if (!student) {
      throw new NotFoundException({
        message: `No student with ID "${dto.studentId}"`,
        code: 'STUDENT_NOT_FOUND',
      });
    }
    const today = await this.settings.today();
    const issue = await this.issues.saveNew({
      copyId: copy.id,
      studentId: student.id,
      issuedOn: today,
      dueOn: addDays(today, dto.days ?? LOAN_DAYS),
      returnedOn: null,
      fine: 0,
      fineInvoiceId: null,
      issuedBy: this.context.current().userId ?? null,
    });
    copy.status = 'issued';
    delete copy.book;
    await this.copies.save(copy);
    return (await this.listIssues('out')).find((i) => i.id === issue.id);
  }

  /** Returns a copy; a late return's fine goes on the student's fees. */
  async return(issueId: string) {
    const issue = await this.issues.findOne({
      where: { id: issueId, returnedOn: IsNull() },
      relations: { copy: { book: true } },
    });
    if (!issue) throw new NotFoundException('That loan is not open');
    const today = await this.settings.today();
    const late = Math.max(0, daysBetween(issue.dueOn, today));
    const fine = late * FINE_PER_DAY;
    let fineInvoiceId: string | null = null;
    if (fine > 0) {
      const invoice = await this.invoices
        .create({
          studentId: issue.studentId,
          note: 'Library fine',
          lines: [
            {
              description: `Library fine: ${issue.copy?.book?.title ?? 'book'} (${late} days late)`,
              amount: fine,
            },
          ],
        })
        .catch(() => null);
      fineInvoiceId = invoice?.id ?? null;
    }
    const copy = issue.copy!;
    delete issue.copy;
    issue.returnedOn = today;
    issue.fine = fine;
    issue.fineInvoiceId = fineInvoiceId;
    await this.issues.save(issue);
    copy.status = 'available';
    delete copy.book;
    await this.copies.save(copy);
    return {
      id: issueId,
      returnedOn: today,
      daysLate: late,
      fine,
      billed: Boolean(fineInvoiceId),
    };
  }

  /** A student's books out now (for the portal). */
  async forStudent(studentId: string) {
    return (await this.listIssues('out')).filter(
      (i) => i.studentId === studentId,
    );
  }
}
