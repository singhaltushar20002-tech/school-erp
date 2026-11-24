# Demo readiness: gap analysis

Analysis date: 18 Nov 2026.

Source: the Google Doc **"Must Have Demo Features"** (22 points) in the shared *School ERP* Drive folder, compared with the code on `main` (`backend/` and `web-2/`).

## Summary

**We're not demo-ready yet, and the main gap is the screens.** The backend already covers about 8 of the 22 must-have features fully or nearly. But `web-2` has only the dashboard home, onboarding, account, home-page settings and the parent home screen. Every other menu item (students, attendance, fees, exams, notices) opens a "Coming soon" page (`web-2/src/app/school/dashboard/[...slug]/page.tsx`, `web-2/src/app/school/student/[...slug]/page.tsx`). On top of that, six features have no code at all: homework, enquiries, UPI payments, transport, library and payroll.

**Market mismatch:** the demo list targets Indian schools, but the system defaults to Bangladesh. That covers currency `BDT`, time zone `Asia/Dhaka` (`backend/src/modules/settings/settings.defaults.ts`), Bangladesh geography for addresses, and NCTB/SSC curriculum and grading templates. Indian defaults matter for the demo as much as the features do.

## Scorecard

| # | Demo feature | Backend | UI (`web-2`) |
|---|---|---|---|
| 1 | One student record across modules | Partial (no transport or library) | None |
| 2 | Enquiry to admission, placed in class during the meeting | Missing | None |
| 3 | Class list and opening balances from Excel, with the buyer's own columns | Students only, fixed template | None |
| 4 | Separate sign-ins for principal, accountant, teacher, parent | Done | Done |
| 5 | Teacher takes attendance on phone, office sees the register | Done | None |
| 6 | Absence alert on WhatsApp/SMS, with delivery status | Partial (event recorded but never sent, email only) | None |
| 7 | Homework and who hasn't submitted | Missing | None |
| 8 | Published timetable, uncovered periods | Partial (no publish state, no staff absence or cover) | None |
| 9 | Fee structure: instalments, concessions, RTE, fine, transport | Done (RTE via a custom discount) | Fee heads in onboarding only |
| 10 | Collection, receipts, audited cancel, today by head | Done | None |
| 11 | Parent pays by UPI | Missing | None |
| 12 | Defaulters 0–30/31–60/60+, remind only 60+ | Partial (buckets differ, no targeted reminder) | None |
| 13 | CBSE/ICSE/state report card PDF | Partial (PDF and letterhead work, Bangladesh grading only) | None |
| 14 | Parent view of their own child | Partial (no homework, timetable or calendar) | Home only |
| 15 | Parent leave, teacher approves, register follows | Done | None |
| 16 | Circulars to a class or whole school, also on WhatsApp | Done except WhatsApp | None |
| 17 | Term calendar | Partial (holidays and exams, no events, nothing for parents) | None |
| 18 | Transport and bus location | Missing | None |
| 19 | Library issue, return, fine | Missing | None |
| 20 | Payroll with TDS/EPF/ESI and payslip | Missing | None |
| 21 | Principal screen | Partial | Live dashboard widgets |
| 22 | Download students, dues, receipts as spreadsheets | Partial (receipts only in the full CSV backup) | None |

## Evidence per area

### Fees (`backend/src/modules/fees/`)

- **Structure (9):** `FeeStructure` / `FeeStructureItem`, frequencies monthly, quarterly, yearly and one-time; `DiscountCode.SIBLING` and `STAFF_CHILD` with an approval flow; `AdjustmentType.WAIVER`; `LateFineRule`; a default `Transport Fee` head (`shared/templates/fee-heads.ts`). There is no RTE preset, so use a 100% custom discount type.
- **Collection (10):** `PaymentService.collect` handles partial and full payment; `POST /receipts/:id/pdf` makes the receipt PDF; `POST /receipts/:id/cancel` needs `fees:cancel_receipt` and writes `RECEIPT_CANCELLED` to the audit log. Today's collection by head comes from `GET /fees/reports/head-wise?from=&to=` (`daily-collection` groups by channel and collector, not by head).
- **UPI (11):** `PaymentChannel` is cash, cheque, card or bank slip. There is no gateway, webhook or portal pay endpoint, and online payments are marked "Phase 1b".
- **Defaulters (12):** `GET /fees/dues` ages dues into 0–30, 31–60, 61–90 and 90+; `GET /fees/reports/defaulters?minDays=61` gives roughly 60+. Reminders are scheduled per invoice only, with no "remind this group" action.
- **Import (3):** the only importers are students, staff and marks, each with fixed template columns. There is no opening-balance importer and no column mapping.
- **Export (22):** `POST /students/export` covers students; `POST /reports/exports` covers `fees.dues` and `fees.defaulters`. Receipts are only in the full `POST /settings/export` CSV backup.
- **Principal screen (21):** `GET /dashboards/admin` has today's collection, attendance percentages, a dues total and enrollment by class. It has no absent count, defaulter count or new admissions this week.

### People and academics

- **Student record (1):** one `students` row is used by fees, attendance, exams and enrollments. There are no transport or library modules.
- **Admissions (2):** there is no enquiry or applicant entity. A student is created with `POST /students`, then placed with `POST /enrollments`.
- **Roles (4):** the seeded system roles include principal, accountant, teacher, class teacher, guardian and student. Guardians get portal accounts on enrollment or import.
- **Attendance (5):** `GET/PUT /attendance/sections/:sectionId` and `GET /attendance/submission-status`, limited to the teacher's assigned sections.
- **Timetable (8):** `GET/POST /timetables` and periods exist. There is no published flag, staff attendance, staff leave or substitution.
- **Report card (13):** the `results.report_cards` PDF job with `report-cards/cards.hbs`, letterhead and logo settings, and a portal download. Grading templates are only BD SSC, Cambridge and madrasa.
- **Leave (15):** parents apply through `POST /portal/children/:id/leave`; the class teacher approves or rejects in `student-leaves`, and the register updates to match.
- **Calendar (17):** holidays, terms and exams exist. There is no events table and no calendar endpoint for parents.
- **Payroll (20):** employee records hold HR fields only, with no salary, tax or statutory data.

### Communication and portal

- **Absence alert (6):** attendance records the `attendance.submitted` event, but `EventDispatcherService` has no handler for it. Notifications go out in-app and by email only, with no SMS or WhatsApp sender. Delivery status is already stored in `delivery_logs` and shown by `GET /communication-log`.
- **Homework (7):** no module.
- **Portal (14):** a parent only sees their own children (enforced by `PortalAccessService.child()`). There are endpoints for the dashboard, attendance, results and report cards, fees, payments and receipts, leave and notices. There are none for homework, timetable or calendar.
- **Circulars (16):** notices go to all, a class or a section, show in the portal and send in-app and email notifications. There is no WhatsApp.
- **Transport (18), Library (19):** only plan keys and the `librarian` role exist.

### Frontend (`web-2`)

- Real screens: dashboard home with live data from `/dashboards/admin|teacher|accountant`, the onboarding wizard (profile, session, classes, curriculum, grading, fees, staff), account, home-page settings, and the parent portal home.
- Everything else in the sidebar and in the portal tabs (Attendance, Results, Fees, Notices) is "Coming soon".
- The layout works on phones: a sheet sidebar for staff and a bottom navigation bar in the portal.
- `frontend/` and `web/` have no working staff screens that `web-2` lacks.

### Demo data

- `npm run db:seed:core` creates platform users only. `npm run perf:seed` builds a 5,000-student school for load testing. There is no demo school with a ready login per role.

## Working points, in priority order

**First: make the existing backend visible.** This needs no new backend logic, and it unlocks about half the list.

1. Fees screens: setup, collect (partial and full), receipt PDF, cancel with reason, today by fee head, dues and defaulters (items 9, 10, 12).
2. Attendance on mobile (take and view register) and the leave approval queue (items 5, 15).
3. Student directory, admit form with section placement, and the Excel import screen (items 1, 3).
4. Exams: mark entry, results, report card PDF (item 13).
5. Notices, written and targeted at a class or the whole school (item 16).
6. Parent portal pages for Attendance, Results, Fees with receipts, Notices and Leave. The APIs already exist (item 14).
7. Exports for students, dues and receipts; receipts needs a small new endpoint (item 22).

**Second: Indian localisation and demo data.**

8. Indian defaults: `INR`, `Asia/Kolkata`, lakh grouping, plus CBSE/ICSE grading and report-card templates (item 13).
9. An RTE discount preset, and defaulter buckets set to 0–30 / 31–60 / 60+, plus a "remind this bucket" action (items 9, 12).
10. A demo seed script: one ready school with one login per role, a filled-in term and a believable data set.

**Third: small backend additions on existing foundations.**

11. Send the absence alert: add a handler for the event attendance already records, plus an SMS/WhatsApp delivery job next to the email one. Delivery status already lives in `delivery_logs` and the communication log (items 6, 16).
12. A UPI payment gateway in sandbox mode, such as Razorpay: payment link, webhook, then the existing collect-payment logic. Due reminders already stop once an invoice is paid (item 11).
13. Principal screen: absent count, defaulter count and new admissions this week (item 21).
14. Parent endpoints for timetable and calendar, a timetable published flag, and a school events table (items 8, 14, 17).
15. Column mapping for imports, and an opening-balance importer (item 3).

**Fourth: new modules with no code today.** The larger builds come first; a few could be shown as "next phase" in the demo.

16. Homework with attachments and a list of who hasn't submitted (item 7).
17. Enquiry to admission, then section placement in the same flow (item 2).
18. Transport routes and stops, and adding the transport fee to the bill. Live bus location could stay a mock (item 18).
19. Library issue, return, overdue fine, and a parent view (item 19).
20. Payroll with LOP, TDS, EPF, ESI and payslips. This needs staff attendance first, which also drives the uncovered-periods part of item 8 (item 20).

If the demo date is close, the first two groups plus items 11 and 12 give a strong demo of about 15 of the 22 features. Mock or defer transport, library and payroll.
