# Database design

How the School ERP stores its data today (`main` at `2bc81c8`, 18 Nov 2026).

## Where data lives

| Store | What it holds |
|-------|---------------|
| **PostgreSQL** | Everything structured: schools, users, students, attendance, exams, fees, settings, audit. This is the system of record. |
| **S3 / MinIO** | File contents only: photos, documents, logos, generated PDFs and exports. Each file's details are in the Postgres `files` table. |
| **Redis** | Background job queues and short-lived cache. No business data. |

The backend reaches Postgres through TypeORM. Entities live in `backend/src/modules/**/entities/*.entity.ts`, and schema changes go through migrations in `backend/src/migrations/`.

## One database shared by every school

All schools share one database and one schema (`public`). There is no database or schema per school.

- A school is a row in `organizations`.
- Every table that belongs to a school has an `org_id` column. Entities get it by extending `OrgScopedEntity`, and it has a cascading foreign key, so deleting a school deletes all of its data.
- **Users are global.** A person has one `users` row and one login. A `memberships` row says which schools they belong to, their role there and whether they are a school admin.
- Uniqueness inside a school always includes `org_id`. For example, class names are unique per `(org_id, name)`, not across all schools.

### How schools are kept apart

There are two independent layers, so one bug can't leak data between schools.

1. **Application:** tenant repositories automatically add `org_id` to every find, save, update and delete. Hand-written query builders must add `org_id` themselves.
2. **Database:** every school-owned table has Postgres row-level security (RLS). At the start of each request the API sets `app.org_id` on its connection, and the `org_isolation` policy only shows rows whose `org_id` matches. When the setting is missing, no rows are visible.

### Two database roles

| Role | Used for | Subject to RLS |
|------|----------|----------------|
| Owner (`DB_USERNAME`) | Migrations, creating schools, platform-wide code and cross-school schedulers | No |
| App role (`DB_APP_USERNAME`) | Every normal API request inside a school | Yes |

The app role can only read and write rows (no schema changes). On `audit_logs` it can only insert and read.

## Design rules used across tables

- **Money** is stored as whole minor units in `bigint` columns (`MoneyColumn`), never as floats.
- **Soft delete:** students, employees, guardians, academic years, student documents, student notes and users are marked deleted (`deleted_at`) instead of being removed, so history is kept. Their unique keys apply only to rows that aren't deleted.
- **"Only one" rules** (one current academic year, one primary class teacher, one primary guardian) are enforced by partial unique indexes as well as in code. A violation becomes a 409 error.
- **Effective-dated assignments:** class-teacher and subject-teacher rows have `effective_from` and `effective_to`. A change closes the current row and opens a new one, and closed rows are history.
- **`jsonb`** holds only flexible data: settings sections, plan limits, notice audiences, grading rules, audit before and after values, event and notification payloads, and job and import results.
- **Sensitive columns** (national ID, health, bank details) are encrypted in the application (`EncryptedColumn`), and are never filtered on or indexed.
- **Numbers** (student IDs, receipts, invoices) come from `numbering_sequences`, taken in the same transaction as the insert that uses them.
- **Audit:** important changes write an `audit_logs` row in the same transaction.

## Files

1. An upload is checked for type, size and the school's storage quota.
2. Its contents go to S3 under `orgs/<orgId>/<folder>/<uuid>`.
3. A `files` row records its name, type, size, checksum, purpose and uploader. Other tables point at it by id, for example `students.photo_file_id` and `jobs.file_id`.
4. Downloads use short-lived signed S3 links, handed out only after checking access to the owning record.

## Tables

There are 99 tables. 86 belong to a school, have `org_id` and are protected by RLS. 13 are shared across the platform.

### Platform (shared)

| Table | Purpose |
|-------|---------|
| `organizations` | One row per school: slug, status, plan, onboarding |
| `organization_slug_history` | Old slugs, kept for 12 months |
| `signup_requests` | Self-serve signups before the school is created |
| `plans` | Subscription plans and what they include |
| `users` | Global login accounts (soft delete) |
| `user_identities` | Linked Google sign-ins |
| `user_sessions` | Sign-in sessions and refresh tokens |
| `auth_tokens` | One-time tokens: verify, reset, activation, handoff |
| `oauth_states` | Short-lived Google sign-in state |
| `geo_divisions`, `geo_districts`, `geo_upazilas` | Bangladesh address lookups |
| `platform_audit_logs` | Platform console audit trail |

### Per school

**Access and settings**

| Table | Purpose |
|-------|---------|
| `organization_domains` | The school's custom domains |
| `memberships` | Which users belong to the school, with role and admin flag |
| `roles`, `user_roles` | The school's roles and who holds them |
| `org_settings` | The school's settings, one `jsonb` column per section |
| `numbering_sequences` | Counters for IDs, receipts and invoices |

**Staff:** `departments`, `designations`, `employees` (soft delete)

**Academic structure**

| Table | Purpose |
|-------|---------|
| `academic_years`, `terms` | Sessions and their terms |
| `classes` | Permanent classes or grades |
| `sections` | A section of one class in one session |
| `shifts`, `rooms`, `periods` | Shifts, rooms and the bell schedule |
| `subjects`, `subject_groups`, `subject_group_subjects` | The subject catalogue and groups such as science or arts |
| `class_subjects`, `class_subject_groups`, `class_subject_components` | What each class studies and how it is marked |
| `class_timetables` | The timetable for each section |
| `class_teachers`, `subject_teachers` | Teacher assignments (effective-dated) |
| `holidays` | The school calendar |

**Students**

| Table | Purpose |
|-------|---------|
| `students` | The student record (soft delete) |
| `student_enrollments`, `enrollment_changes` | Which section a student is in each session, and moves between sections |
| `student_status_history` | Status changes such as active, transferred or left |
| `guardians`, `student_guardians` | Guardians and their links to students |
| `student_addresses`, `student_emergency_contacts`, `student_medical_records` | Profile details |
| `student_documents`, `student_notes` | Uploaded documents and staff notes (soft delete) |
| `student_subjects` | Optional and elective subject choices |
| `promotion_batches`, `promotion_batch_items` | Year-end promotion |
| `certificates` | Transfer and character certificates |
| `imports` | Excel import batches |

**Attendance:** `attendance_registers` (one per section and day), `attendance_records` (one per student), `attendance_statuses`, `attendance_corrections`, `student_leave_requests`

**Grading:** `grading_systems`, `grade_scale_items`, `class_grading`

**Exams and results:** `exam_types`, `exams`, `exam_subjects`, `exam_subject_components`, `mark_sheets`, `marks`, `result_definitions`, `results`, `result_subjects`

**Fees**

| Table | Purpose |
|-------|---------|
| `fee_heads`, `fee_structures`, `fee_structure_items` | What is charged, per class and session |
| `late_fine_rules`, `discount_types`, `student_discounts` | Fines and discounts |
| `invoices`, `invoice_lines`, `billing_runs` | Bills and the runs that create them |
| `adjustments` | Waivers and corrections (need approval) |
| `payments`, `payment_allocations`, `receipts`, `payment_reversals` | Money received, which lines it paid and cancelled receipts |
| `expense_categories`, `expenses` | School expenses |
| `ledger_entries` | Every money movement |

**Communication:** `notices`, `notice_reads`, `notifications`, `notification_templates`, `delivery_logs`, `domain_events` (outbox of events waiting to become notifications)

**Files, audit and jobs:** `files`, `audit_logs` (insert and read only), `jobs`, `idempotency_keys`

## Action items

The design stays as it is: Postgres for records, `jsonb` for flexible fields, S3 for file contents. These fixes bring the code fully in line with it.

| Priority | Action | Effort |
|----------|--------|--------|
| High | Clean up generated files | 1 day |
| Medium | Store invoice discounts in a table | 1–2 days |
| Medium | Remove S3 objects that have no `files` row | 1 day |
| Medium | Add foreign keys to file references | 1 day |
| Low | Limit import size | 0.5 day |

1. **Clean up generated files.** Exports, PDF bundles and data-export ZIP files (up to 200 MB) are never deleted, and they count toward the school's storage quota. Delete `generated` files after 7–30 days with a scheduled job, or leave them out of the quota and expire them with an S3 lifecycle rule.
2. **Store invoice discounts in a table.** `invoice_lines.discounts` keeps money amounts inside `jsonb`, with nothing checking the discount type. Add an `invoice_line_discounts` table (line, discount type, `bigint` amount) and move the existing data over in a migration.
3. **Remove S3 objects that have no `files` row.** When a request rolls back after its upload, the S3 object stays behind. Add a weekly job that deletes S3 objects with no `files` row that are older than a day.
4. **Add foreign keys to file references.** `student_documents.file_id`, `organizations.logo_file_id`, `jobs.file_id`, `imports.file_id`, `results.report_card_file_id` and `student_leave_requests.attachment_file_id` should reference `files` with `ON DELETE SET NULL`. The id arrays `notices.attachment_file_ids` and `expenses.attachment_file_ids` should become link tables.
5. **Limit import size.** `imports.rows` keeps every parsed row in `jsonb` with no limit. Cap the rows (for example 5,000) or clear them once the import is committed.

Later, the transport, library, payroll, homework and enquiry/admission features from the demo list will each need new tables. Each must follow the rules above: `org_id`, RLS, grants for the app role and a migration.
