import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 4 of the demo plan:
 *
 * - `school_events`: the term calendar's events (with holidays and exams).
 * - `timetable_publications`: a section's timetable is visible to parents.
 * - `homework` and `homework_submissions`.
 * - `enquiries`: admission enquiries and their follow-up.
 * - RLS and app-role grants on each; the new permission keys on system
 *   roles (frozen copy).
 */
const ORG_EXPR = `NULLIF(current_setting('app.org_id', true), '')::uuid`;

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

function appRole(): string | null {
  const name = process.env.DB_APP_USERNAME?.trim();
  return name ? quoteIdent(name) : null;
}

const NEW_ORG_TABLES = [
  'school_events',
  'timetable_publications',
  'homework',
  'homework_submissions',
  'enquiries',
];

const NEW_KEYS = [
  'events:manage',
  'homework:read',
  'homework:manage',
  'enquiries:read',
  'enquiries:manage',
];

/** Keys added to each system role (frozen at this migration). */
const ROLE_KEYS: Record<string, string[]> = {
  admin: NEW_KEYS,
  principal: [
    'events:manage',
    'homework:read',
    'enquiries:read',
    'enquiries:manage',
  ],
  teacher: ['homework:read', 'homework:manage'],
  class_teacher: ['homework:read', 'homework:manage'],
  receptionist: ['events:manage', 'enquiries:read', 'enquiries:manage'],
};

const orgFk = (table: string) =>
  `ALTER TABLE "${table}" ADD CONSTRAINT "fk_${table}_org" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`;

const CREATE = [
  `CREATE TABLE "school_events" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(160) NOT NULL, "description" text, "kind" character varying(16) NOT NULL, "date_from" date NOT NULL, "date_to" date NOT NULL, "class_ids" uuid array NOT NULL DEFAULT '{}', "for_parents" boolean NOT NULL DEFAULT true, "created_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "pk_school_events" PRIMARY KEY ("id"))`,
  `CREATE INDEX "idx_school_events_org" ON "school_events" ("org_id")`,
  `CREATE INDEX "idx_school_events_org_dates" ON "school_events" ("org_id", "date_from", "date_to")`,
  orgFk('school_events'),

  `CREATE TABLE "timetable_publications" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "section_id" uuid NOT NULL, "published_at" TIMESTAMP WITH TIME ZONE NOT NULL, "published_by" uuid, CONSTRAINT "pk_timetable_publications" PRIMARY KEY ("id"))`,
  `CREATE INDEX "idx_timetable_publications_org" ON "timetable_publications" ("org_id")`,
  `CREATE UNIQUE INDEX "uq_timetable_publications_section" ON "timetable_publications" ("org_id", "section_id")`,
  orgFk('timetable_publications'),
  `ALTER TABLE "timetable_publications" ADD CONSTRAINT "fk_timetable_publications_section" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,

  `CREATE TABLE "homework" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "section_id" uuid NOT NULL, "class_subject_id" uuid NOT NULL, "title" character varying(200) NOT NULL, "description" text, "assigned_on" date NOT NULL, "due_date" date NOT NULL, "attachment_file_ids" uuid array NOT NULL DEFAULT '{}', "created_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "pk_homework" PRIMARY KEY ("id"))`,
  `CREATE INDEX "idx_homework_org" ON "homework" ("org_id")`,
  `CREATE INDEX "idx_homework_section_due" ON "homework" ("org_id", "section_id", "due_date")`,
  orgFk('homework'),
  `ALTER TABLE "homework" ADD CONSTRAINT "fk_homework_section" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "homework" ADD CONSTRAINT "fk_homework_class_subject" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,

  `CREATE TABLE "homework_submissions" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "homework_id" uuid NOT NULL, "enrollment_id" uuid NOT NULL, "marked_by" uuid, "marked_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "pk_homework_submissions" PRIMARY KEY ("id"))`,
  `CREATE INDEX "idx_homework_submissions_org" ON "homework_submissions" ("org_id")`,
  `CREATE UNIQUE INDEX "uq_homework_submissions" ON "homework_submissions" ("org_id", "homework_id", "enrollment_id")`,
  orgFk('homework_submissions'),
  `ALTER TABLE "homework_submissions" ADD CONSTRAINT "fk_homework_submissions_homework" FOREIGN KEY ("homework_id") REFERENCES "homework"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,

  `CREATE TABLE "enquiries" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_name" character varying(160) NOT NULL, "date_of_birth" date, "gender" character varying(16), "class_id" uuid, "guardian_name" character varying(160) NOT NULL, "phone" character varying(20) NOT NULL, "email" character varying(160), "previous_school" character varying(160), "source" character varying(16) NOT NULL, "stage" character varying(16) NOT NULL DEFAULT 'new', "notes" text, "follow_up_on" date, "lost_reason" text, "admitted_student_id" uuid, "created_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "pk_enquiries" PRIMARY KEY ("id"))`,
  `CREATE INDEX "idx_enquiries_org" ON "enquiries" ("org_id")`,
  `CREATE INDEX "idx_enquiries_org_stage" ON "enquiries" ("org_id", "stage")`,
  orgFk('enquiries'),
];

export class CalendarTimetableHomeworkEnquiries1792450000000 implements MigrationInterface {
  name = 'CalendarTimetableHomeworkEnquiries1792450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of CREATE) await queryRunner.query(sql);
    const role = appRole();
    for (const table of NEW_ORG_TABLES) {
      const t = `public.${quoteIdent(table)}`;
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
      console.warn('Phase 4: DB_APP_USERNAME is not set, skipping grants.');
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
    for (const table of [
      'homework_submissions',
      'homework',
      'timetable_publications',
      'school_events',
      'enquiries',
    ]) {
      await queryRunner.query(`DROP TABLE "${table}"`);
    }
  }
}
