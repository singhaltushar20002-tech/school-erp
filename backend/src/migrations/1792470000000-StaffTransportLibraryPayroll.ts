import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 of the demo plan: staff attendance and leave, substitute
 * teachers, transport (routes, stops, students on stops), the library
 * (books, copies, issues) and payroll (salary structures, runs,
 * payslips). RLS and app-role grants on each table; the new permission
 * keys on system roles (frozen copy).
 */
const ORG_EXPR = `NULLIF(current_setting('app.org_id', true), '')::uuid`;

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

function appRole(): string | null {
  const name = process.env.DB_APP_USERNAME?.trim();
  return name ? quoteIdent(name) : null;
}

const TABLES = [
  'staff_attendance',
  'staff_leaves',
  'substitutions',
  'transport_routes',
  'transport_stops',
  'transport_assignments',
  'library_books',
  'library_copies',
  'library_issues',
  'salary_structures',
  'payroll_runs',
  'payslips',
];

const NEW_KEYS = [
  'staff_attendance:manage',
  'staff_leaves:approve',
  'substitutions:manage',
  'transport:read',
  'transport:manage',
  'library:read',
  'library:manage',
  'payroll:read',
  'payroll:manage',
];

const ROLE_KEYS: Record<string, string[]> = {
  admin: NEW_KEYS,
  principal: [
    'staff_attendance:manage',
    'staff_leaves:approve',
    'substitutions:manage',
    'transport:read',
    'library:read',
    'payroll:read',
  ],
  accountant: ['transport:read', 'payroll:read', 'payroll:manage'],
  receptionist: [
    'staff_attendance:manage',
    'substitutions:manage',
    'transport:read',
    'transport:manage',
  ],
  librarian: ['library:read', 'library:manage'],
};

const T = `"created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now()`;
const fk = (table: string, col: string, ref: string, onDelete = 'CASCADE') =>
  `ALTER TABLE "${table}" ADD CONSTRAINT "fk_${table}_${col}" FOREIGN KEY ("${col}") REFERENCES "${ref}"("id") ON DELETE ${onDelete} ON UPDATE NO ACTION`;

const CREATE = [
  `CREATE TABLE "staff_attendance" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employee_id" uuid NOT NULL, "date" date NOT NULL, "status" character varying(16) NOT NULL, "marked_by" uuid, ${T}, CONSTRAINT "pk_staff_attendance" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX "uq_staff_attendance" ON "staff_attendance" ("org_id", "employee_id", "date")`,
  `CREATE INDEX "idx_staff_attendance_date" ON "staff_attendance" ("org_id", "date")`,
  fk('staff_attendance', 'employee_id', 'employees'),

  `CREATE TABLE "staff_leaves" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employee_id" uuid NOT NULL, "from_date" date NOT NULL, "to_date" date NOT NULL, "leave_type" character varying(16) NOT NULL, "reason" text, "status" character varying(16) NOT NULL DEFAULT 'pending', "requested_by" uuid, "decided_by" uuid, "decided_at" TIMESTAMP WITH TIME ZONE, ${T}, CONSTRAINT "pk_staff_leaves" PRIMARY KEY ("id"))`,
  `CREATE INDEX "idx_staff_leaves_status" ON "staff_leaves" ("org_id", "status")`,
  fk('staff_leaves', 'employee_id', 'employees'),

  `CREATE TABLE "substitutions" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" date NOT NULL, "timetable_id" uuid NOT NULL, "substitute_employee_id" uuid NOT NULL, "assigned_by" uuid, ${T}, CONSTRAINT "pk_substitutions" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX "uq_substitutions" ON "substitutions" ("org_id", "date", "timetable_id")`,
  fk('substitutions', 'timetable_id', 'class_timetables'),
  fk('substitutions', 'substitute_employee_id', 'employees'),

  `CREATE TABLE "transport_routes" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(80) NOT NULL, "vehicle_number" character varying(24), "driver_name" character varying(80), "driver_phone" character varying(20), "monthly_fee" bigint NOT NULL DEFAULT '0', ${T}, CONSTRAINT "pk_transport_routes" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX "uq_transport_routes_name" ON "transport_routes" ("org_id", "name")`,

  `CREATE TABLE "transport_stops" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "route_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "pickup_time" time, "drop_time" time, "sort_order" integer NOT NULL DEFAULT '0', ${T}, CONSTRAINT "pk_transport_stops" PRIMARY KEY ("id"))`,
  `CREATE INDEX "idx_transport_stops_route" ON "transport_stops" ("org_id", "route_id")`,
  fk('transport_stops', 'route_id', 'transport_routes'),

  `CREATE TABLE "transport_assignments" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "stop_id" uuid NOT NULL, ${T}, CONSTRAINT "pk_transport_assignments" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX "uq_transport_assignments_student" ON "transport_assignments" ("org_id", "student_id")`,
  fk('transport_assignments', 'stop_id', 'transport_stops'),
  fk('transport_assignments', 'student_id', 'students'),

  `CREATE TABLE "library_books" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(200) NOT NULL, "author" character varying(160), "isbn" character varying(20), "category" character varying(60), "publisher" character varying(120), ${T}, CONSTRAINT "pk_library_books" PRIMARY KEY ("id"))`,
  `CREATE INDEX "idx_library_books_title" ON "library_books" ("org_id", "title")`,

  `CREATE TABLE "library_copies" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "book_id" uuid NOT NULL, "accession_no" character varying(24) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'available', ${T}, CONSTRAINT "pk_library_copies" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX "uq_library_copies_accession" ON "library_copies" ("org_id", "accession_no")`,
  fk('library_copies', 'book_id', 'library_books'),

  `CREATE TABLE "library_issues" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "copy_id" uuid NOT NULL, "student_id" uuid NOT NULL, "issued_on" date NOT NULL, "due_on" date NOT NULL, "returned_on" date, "fine" bigint NOT NULL DEFAULT '0', "fine_invoice_id" uuid, "issued_by" uuid, ${T}, CONSTRAINT "pk_library_issues" PRIMARY KEY ("id"))`,
  `CREATE INDEX "idx_library_issues_open" ON "library_issues" ("org_id", "returned_on")`,
  `CREATE INDEX "idx_library_issues_student" ON "library_issues" ("org_id", "student_id")`,
  `CREATE UNIQUE INDEX "uq_library_issues_open_copy" ON "library_issues" ("org_id", "copy_id") WHERE "returned_on" IS NULL`,
  fk('library_issues', 'copy_id', 'library_copies'),
  fk('library_issues', 'student_id', 'students'),

  `CREATE TABLE "salary_structures" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employee_id" uuid NOT NULL, "basic" bigint NOT NULL DEFAULT '0', "hra" bigint NOT NULL DEFAULT '0', "da" bigint NOT NULL DEFAULT '0', "other_allowances" bigint NOT NULL DEFAULT '0', "pf_applicable" boolean NOT NULL DEFAULT true, "esi_applicable" boolean NOT NULL DEFAULT false, "tds_monthly" bigint NOT NULL DEFAULT '0', ${T}, CONSTRAINT "pk_salary_structures" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX "uq_salary_structures_employee" ON "salary_structures" ("org_id", "employee_id")`,
  fk('salary_structures', 'employee_id', 'employees'),

  `CREATE TABLE "payroll_runs" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "period" character varying(7) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'draft', "created_by" uuid, "finalized_at" TIMESTAMP WITH TIME ZONE, "finalized_by" uuid, ${T}, CONSTRAINT "pk_payroll_runs" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX "uq_payroll_runs_period" ON "payroll_runs" ("org_id", "period")`,

  `CREATE TABLE "payslips" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "run_id" uuid NOT NULL, "employee_id" uuid NOT NULL, "days_in_month" integer NOT NULL, "lop_days" numeric(5,1) NOT NULL DEFAULT '0', "gross" bigint NOT NULL DEFAULT '0', "earnings" jsonb NOT NULL DEFAULT '[]', "deductions" jsonb NOT NULL DEFAULT '[]', "total_deductions" bigint NOT NULL DEFAULT '0', "net" bigint NOT NULL DEFAULT '0', ${T}, CONSTRAINT "pk_payslips" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX "uq_payslips_run_employee" ON "payslips" ("org_id", "run_id", "employee_id")`,
  fk('payslips', 'run_id', 'payroll_runs'),
  fk('payslips', 'employee_id', 'employees'),
];

export class StaffTransportLibraryPayroll1792470000000 implements MigrationInterface {
  name = 'StaffTransportLibraryPayroll1792470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of CREATE) await queryRunner.query(sql);
    const role = appRole();
    for (const table of TABLES) {
      const t = `public.${quoteIdent(table)}`;
      await queryRunner.query(
        `CREATE INDEX "idx_${table}_org" ON ${t} ("org_id")`,
      );
      await queryRunner.query(
        `ALTER TABLE ${t} ADD CONSTRAINT "fk_${table}_org" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      );
      await queryRunner.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(
        `CREATE POLICY org_isolation ON ${t} USING (org_id = ${ORG_EXPR}) WITH CHECK (org_id = ${ORG_EXPR})`,
      );
      if (role) {
        await queryRunner.query(
          `GRANT SELECT, INSERT, UPDATE, DELETE ON ${t} TO ${role}`,
        );
      }
    }
    if (!role) {
      console.warn('Phase 5: DB_APP_USERNAME is not set, skipping grants.');
    }
    for (const [name, keys] of Object.entries(ROLE_KEYS)) {
      await queryRunner.query(
        `UPDATE "roles"
         SET "permissions" = "permissions" || ARRAY(
               SELECT k FROM unnest($2::text[]) AS k
               WHERE NOT (k = ANY("permissions"))
             ),
             "updated_at" = now()
         WHERE "is_system" AND "name" = $1`,
        [name, keys],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "roles" SET "permissions" = ARRAY(
         SELECT k FROM unnest("permissions") AS k WHERE NOT (k = ANY($1::text[]))
       )`,
      [NEW_KEYS],
    );
    for (const table of [...TABLES].reverse()) {
      await queryRunner.query(`DROP TABLE "${table}"`);
    }
  }
}
