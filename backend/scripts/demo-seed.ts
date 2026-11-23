/**
 * Demo school seed: builds "Greenfield Public School", a CBSE school in
 * Lucknow, with the data a sales demo needs, through the real API, import
 * and billing code so everything is consistent.
 *
 *   npm run seed:demo
 *
 * Runs against the local development database (`.env.local`), which must
 * be migrated. Each run deletes the previous demo school (slug `greenfield`) and
 * the accounts only it used, then builds it again; nothing else is touched.
 *
 * Seeded: the 2026–27 session (April–March) with India's holidays and two
 * school breaks; the CBSE curriculum (classes 1–12, sections A and B; 11–12
 * in Science and Commerce) and grading scale; ~620 students imported through
 * the Excel importer with both parents (phones +91); 30 staff with a class
 * teacher for every section; fee heads, class-wise structures, sibling /
 * staff-ward / RTE concessions and a late fine; invoices April–November
 * with a realistic payment history (most paid, some 0–30 / 31–60 / 60+ days
 * behind, a few partial, some collected today); attendance since April
 * (today's register left open for Class 5 A); the Half-Yearly exam for
 * classes 1–10 marked, approved and published; and two circulars.
 *
 * Every demo login uses the password printed at the end.
 */
import './demo-seed.env';
import type { AddressInfo } from 'node:net';
import { performance } from 'node:perf_hooks';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { DataSource } from 'typeorm';
import { AppModule } from 'src/app.module';
import { configureApp } from 'src/app.setup';
import { hashPassword } from '~/common/identity/password';
import { addDays, localDate } from '~/shared/dates/local-date';
import { MailService } from '~/shared/mail/mail.service';
import { InlineJobQueue, JobQueue } from '~/shared/queue';
import { SessionService } from '~/modules/auth/services/session.service';
import { FeeScheduler } from '~/modules/fees/fee.scheduler';
import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';
import { OrganizationService } from '~/modules/organizations/services/organization.service';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { MailCapture } from '../test/support/app';

// ------------------------------------------------------------- the school

const SLUG = 'greenfield';
const SCHOOL = 'Greenfield Public School';
const EMAIL_DOMAIN = 'greenfield.test';
const PASSWORD = 'Demo@1234';
const TIME_ZONE = 'Asia/Kolkata';
const YEAR_START = '2026-04-01';
const YEAR_END = '2027-03-31';
const CLASSES = 12;
const SECTIONS = ['A', 'B'];
/** Classes 11–12: section A is the Science stream, B Commerce. */
const STREAM: Record<string, string> = { A: 'Science', B: 'Commerce' };
const DEMO_TEACHER_SECTION = '5:A';
/** The parent who signs in: two children in the school. */
const PARENT_PHONE = '9876500001';
const CONCURRENCY = 8;

/** Monthly tuition by class (paise). */
const tuition = (c: number) =>
  c <= 5 ? 250_000 : c <= 8 ? 300_000 : c <= 10 ? 350_000 : 420_000;

const MALE = [
  'Aarav',
  'Vivaan',
  'Aditya',
  'Vihaan',
  'Arjun',
  'Sai',
  'Reyansh',
  'Ayaan',
  'Krishna',
  'Ishaan',
  'Shaurya',
  'Atharv',
  'Advik',
  'Pranav',
  'Rudra',
  'Kabir',
  'Dhruv',
  'Aryan',
  'Rohan',
  'Kartik',
  'Yash',
  'Harsh',
  'Dev',
  'Mohammed',
  'Faizan',
  'Zaid',
  'Gurpreet',
  'Manav',
  'Nikhil',
  'Tanmay',
];
const FEMALE = [
  'Ananya',
  'Diya',
  'Aadhya',
  'Saanvi',
  'Pari',
  'Anika',
  'Navya',
  'Myra',
  'Sara',
  'Ira',
  'Aarohi',
  'Kavya',
  'Riya',
  'Ishita',
  'Meera',
  'Tanvi',
  'Sneha',
  'Pooja',
  'Nandini',
  'Shreya',
  'Avni',
  'Kiara',
  'Zoya',
  'Fatima',
  'Harleen',
  'Simran',
  'Aditi',
  'Khushi',
  'Prisha',
  'Mahi',
];
const FATHERS = [
  'Rajesh',
  'Suresh',
  'Amit',
  'Sanjay',
  'Vikram',
  'Rahul',
  'Manoj',
  'Anil',
  'Deepak',
  'Ashok',
  'Rakesh',
  'Pankaj',
  'Sunil',
  'Vinod',
  'Ajay',
  'Imran',
  'Salim',
  'Harpreet',
  'Naveen',
  'Alok',
];
const MOTHERS = [
  'Sunita',
  'Anita',
  'Priya',
  'Neha',
  'Kavita',
  'Rekha',
  'Pooja',
  'Seema',
  'Meenakshi',
  'Shalini',
  'Nisha',
  'Ritu',
  'Shabana',
  'Gurleen',
  'Asha',
  'Swati',
  'Deepa',
  'Rashmi',
  'Usha',
  'Geeta',
];
const SURNAMES = [
  'Sharma',
  'Verma',
  'Gupta',
  'Singh',
  'Kumar',
  'Mishra',
  'Pandey',
  'Srivastava',
  'Tiwari',
  'Agarwal',
  'Yadav',
  'Chauhan',
  'Saxena',
  'Khan',
  'Siddiqui',
  'Kapoor',
  'Malhotra',
  'Joshi',
  'Rastogi',
  'Dubey',
  'Tripathi',
  'Bajpai',
  'Kohli',
  'Ansari',
];
const OCCUPATIONS = [
  'Business',
  'Service',
  'Government service',
  'Doctor',
  'Engineer',
  'Teacher',
  'Advocate',
  'Shopkeeper',
  'Bank officer',
  'Self-employed',
];

// ---------------------------------------------------------------- helpers

const log = (msg: string) => console.log(`[demo] ${msg}`);

async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t = performance.now();
  const out = await fn();
  log(`${label} (${Math.round((performance.now() - t) / 100) / 10}s)`);
  return out;
}

/** Runs `fn` over `items`, `n` at a time. */
async function pool<T, R>(
  items: T[],
  n: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

/** Deterministic pseudo-random numbers, so every run builds the same school. */
let rngState = 2026;
const rand = () => {
  // mulberry32
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
};
const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
const pad = (n: number) => String(n).padStart(2, '0');

interface Row {
  id: string;
  [key: string]: unknown;
}

class Api {
  constructor(private readonly base: string) {}

  async call<T = unknown>(
    token: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const isForm = body instanceof FormData;
    const res = await fetch(`${this.base}/api${path}`, {
      method,
      headers: {
        'x-tenant-id': SLUG,
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && !isForm
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body:
        body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `${method} ${path} → ${res.status}: ${text.slice(0, 600)}`,
      );
    }
    return (text ? (JSON.parse(text) as { data: T }) : { data: undefined as T })
      .data;
  }

  async bytes(token: string, path: string): Promise<ArrayBuffer> {
    const res = await fetch(`${this.base}/api${path}`, {
      headers: { 'x-tenant-id': SLUG, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.arrayBuffer();
  }
}

let api: Api;
const get = <T>(token: string, path: string) => api.call<T>(token, 'GET', path);
const post = <T = Row>(token: string, path: string, body: unknown = {}) =>
  api.call<T>(token, 'POST', path, body);
const put = <T = Row>(token: string, path: string, body: unknown) =>
  api.call<T>(token, 'PUT', path, body);
const patch = <T = Row>(token: string, path: string, body: unknown) =>
  api.call<T>(token, 'PATCH', path, body);

interface JobView {
  status: string;
  result: Record<string, unknown> | null;
  error: string | null;
}

// ------------------------------------------------------------------- boot

async function boot() {
  const mail = new MailCapture();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail.service)
    .compile();
  const app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const { port } = (
    app.getHttpServer() as { address(): AddressInfo }
  ).address();
  return {
    app,
    root: app.get<DataSource>(getDataSourceToken()),
    base: `http://127.0.0.1:${port}`,
  };
}

async function tokenFor(
  app: INestApplication,
  userId: string,
  orgId: string,
  isAdmin: boolean,
) {
  const { sessionId } = await app.get(SessionService).start(userId, orgId);
  return new JwtService({ secret: process.env.JWT_SECRET }).sign(
    { sub: userId, orgId, isAdmin, sid: sessionId },
    { expiresIn: '2h' },
  );
}

async function drain(app: INestApplication) {
  await app.get<JobQueue, InlineJobQueue>(JobQueue).drain();
}

async function waitJob(app: INestApplication, token: string, id: string) {
  await drain(app);
  const view = await get<JobView>(token, `/jobs/${id}`);
  if (view.status !== 'succeeded') {
    throw new Error(`Job ${id} ${view.status}: ${view.error ?? ''}`);
  }
  return view;
}

/** Deletes the previous demo school and the accounts only it used. */
async function cleanup(root: DataSource) {
  const [org] = await root.query<{ id: string }[]>(
    'SELECT id FROM organizations WHERE slug = $1',
    [SLUG],
  );
  if (org) {
    await root.query(
      `DELETE FROM users u WHERE u.id IN (SELECT user_id FROM memberships WHERE org_id = $1)
         AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id AND m.org_id <> $1)`,
      [org.id],
    );
    await root.query('DELETE FROM organizations WHERE id = $1', [org.id]);
    log('deleted the previous demo school');
  }
  await root.query(`DELETE FROM users WHERE email LIKE $1`, [
    `%@${EMAIL_DOMAIN}`,
  ]);
}

/** Signs an account in with the demo password, active in the demo school. */
async function activate(root: DataSource, userId: string, orgId: string) {
  await root.query(
    `UPDATE users SET password = $2, password_set = true, must_change_password = false,
            status = 'active', email_verified_at = COALESCE(email_verified_at, now())
      WHERE id = $1`,
    [userId, await hashPassword(PASSWORD)],
  );
  await root.query(
    `UPDATE memberships SET status = 'active' WHERE user_id = $1 AND org_id = $2`,
    [userId, orgId],
  );
}

// ------------------------------------------------------------------ seed

interface Family {
  surname: string;
  father: string;
  mother: string;
  fatherPhone: string;
  motherPhone: string;
  occupation: string;
  /** RTE seat, staff ward. */
  rte: boolean;
  staffWard: boolean;
}

interface Pupil {
  first: string;
  gender: 'male' | 'female';
  dob: string;
  cls: number;
  section: string;
  roll: number;
  family: number;
}

/** Student roster: 22–30 per section, about one family in twelve with two children. */
function roster(): { pupils: Pupil[]; families: Family[] } {
  const families: Family[] = [];
  const pupils: Pupil[] = [];
  const newFamily = (): number => {
    const n = families.length;
    families.push({
      surname: pick(SURNAMES),
      father: pick(FATHERS),
      mother: pick(MOTHERS),
      fatherPhone:
        n === 0 ? PARENT_PHONE : `98${String(76_500_001 + n * 2).slice(-8)}`,
      motherPhone: `97${String(21_400_000 + n * 2).slice(-8)}`,
      occupation: pick(OCCUPATIONS),
      rte: false,
      staffWard: false,
    });
    return n;
  };
  // Family 0 is the demo parent: a child in 5 A and one in 8 B.
  newFamily();
  for (let c = 1; c <= CLASSES; c++) {
    for (const section of SECTIONS) {
      const size = 22 + Math.floor(rand() * 9);
      for (let r = 1; r <= size; r++) {
        const gender = rand() < 0.5 ? 'male' : 'female';
        const birthYear = 2026 - 6 - c;
        let family: number;
        if (
          (c === 5 && section === 'A' && r === 1) ||
          (c === 8 && section === 'B' && r === 1)
        ) {
          family = 0;
        } else if (rand() < 0.08 && families.length > 30) {
          // A younger or older sibling of an earlier pupil.
          family = 1 + Math.floor(rand() * (families.length - 1));
        } else {
          family = newFamily();
        }
        pupils.push({
          first: pick(gender === 'male' ? MALE : FEMALE),
          gender,
          dob: `${birthYear}-${pad(1 + Math.floor(rand() * 12))}-${pad(1 + Math.floor(rand() * 28))}`,
          cls: c,
          section,
          roll: r,
          family,
        });
      }
    }
  }
  // RTE seats: entry class (Class 1), a few staff wards.
  pupils
    .filter((p) => p.cls === 1 && p.family !== 0)
    .slice(0, 6)
    .filter((_, i) => i % 2 === 0)
    .forEach((p) => (families[p.family].rte = true));
  pupils
    .filter((p) => (p.cls === 3 || p.cls === 7) && p.roll === 5)
    .forEach((p) => (families[p.family].staffWard = true));
  return { pupils, families };
}

async function seed(app: INestApplication, root: DataSource, base: string) {
  await cleanup(root);
  api = new Api(base);
  const today = localDate(TIME_ZONE);
  const users = root.getRepository(User);
  const passwordHash = await hashPassword(PASSWORD);

  // School and its owner (the director, a school admin).
  const owner = await users.save(
    users.create({
      email: `director@${EMAIL_DOMAIN}`,
      name: 'Rajiv Agarwal',
      password: passwordHash,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    }),
  );
  const org = await root.transaction((manager) =>
    app.get(OrganizationService).createForSignup(manager, {
      name: SCHOOL,
      slug: SLUG,
      type: OrganizationType.SCHOOL,
      ownerUserId: owner.id,
    }),
  );
  const orgId = org.id;
  await activate(root, owner.id, orgId);
  // A paying school on Premium (no trial to run out), set up already.
  await root.query(
    `UPDATE organizations SET status = 'active', trial_ends_at = NULL,
            plan_id = (SELECT id FROM plans WHERE code = 'premium'),
            onboarding_completed_at = now(), curriculum_template = 'cbse'
      WHERE id = $1`,
    [orgId],
  );
  const admin = await tokenFor(app, owner.id, orgId, true);

  await step('school profile', async () => {
    await patch(admin, '/settings/profile', {
      address: {
        line1: 'Plot 7, Sector 14, Vikas Nagar',
        area: 'Aliganj',
        district: 'Lucknow',
        postCode: '226022',
      },
      phone: '+915224001234',
      email: `office@${EMAIL_DOMAIN}`,
      website: 'https://greenfield.test',
      establishedYear: 1998,
      principalName: 'Dr. Anjali Mehra',
    });
    await patch(admin, '/settings/organization', { eiin: '09271500105' });
  });

  // Session, holidays, curriculum, grading, fee heads.
  const ids: Record<string, string> = {};
  const classIds: Record<number, string> = {};
  const sectionIds: Record<string, string> = {};
  await step('session, holidays, CBSE curriculum and grading', async () => {
    ids.year = (
      await post(admin, '/academic-years', {
        name: '2026–2027',
        startDate: YEAR_START,
        endDate: YEAR_END,
        isCurrent: true,
      })
    ).id;
    for (const year of [2026, 2027]) {
      await post(admin, '/onboarding/templates/holidays/apply', { year });
    }
    for (const h of [
      { name: 'Summer vacation', dateFrom: '2026-05-18', dateTo: '2026-06-30' },
      { name: 'Winter break', dateFrom: '2026-12-26', dateTo: '2027-01-02' },
    ]) {
      await post(admin, '/holidays', { ...h, type: 'school', classIds: [] });
    }
    await post(admin, '/onboarding/templates/grading/cbse/apply');
    await post(admin, '/onboarding/templates/curriculum/cbse/apply', {
      academicYearId: ids.year,
    });
    await post(admin, '/onboarding/templates/fee-heads/apply');
    const classes = await get<{ id: string; name: string; level: number }[]>(
      admin,
      '/classes?limit=100',
    );
    for (const c of classes) classIds[c.level] = c.id;
    // Two terms, as most CBSE schools report them.
    for (const [i, term] of [
      ['Term 1', YEAR_START, '2026-09-30'],
      ['Term 2', '2026-10-01', YEAR_END],
    ].entries()) {
      await post(admin, '/terms', {
        academicYearId: ids.year,
        name: term[0],
        startDate: term[1],
        endDate: term[2],
        sortOrder: i + 1,
      });
    }
    // Rooms: a home room per section (floor by class) plus shared ones.
    const roomIds: Record<string, string> = {};
    for (let c = 1; c <= CLASSES; c++) {
      for (const [i, name] of SECTIONS.entries()) {
        const number = `${Math.ceil(c / 4)}${pad(((c - 1) % 4) * 2 + i + 1)}`;
        roomIds[`${c}:${name}`] = (
          await post(admin, '/rooms', {
            name: `Room ${number}`,
            building: c <= 5 ? 'Junior block' : 'Senior block',
            capacity: 45,
            type: 'classroom',
          })
        ).id;
      }
    }
    for (const room of [
      { name: 'Physics lab', type: 'lab', capacity: 30 },
      { name: 'Chemistry lab', type: 'lab', capacity: 30 },
      { name: 'Biology lab', type: 'lab', capacity: 30 },
      { name: 'Computer lab', type: 'lab', capacity: 40 },
      { name: 'Assembly hall', type: 'hall', capacity: 600 },
      { name: 'Library', type: 'library', capacity: 60 },
    ]) {
      await post(admin, '/rooms', { ...room, building: 'Senior block' });
    }
    for (let c = 1; c <= CLASSES; c++) {
      for (const name of SECTIONS) {
        sectionIds[`${c}:${name}`] = (
          await post(admin, '/sections', {
            academicYearId: ids.year,
            classId: classIds[c],
            name,
            roomId: roomIds[`${c}:${name}`],
            capacity: 45,
          })
        ).id;
      }
    }
    // Periods a week and pass/full marks for every class subject.
    await root.query(
      `UPDATE class_subjects cs SET
         weekly_classes = CASE
           WHEN s.name IN ('Mathematics', 'English', 'Science') THEN 6
           WHEN s.name IN ('Hindi', 'Social Science', 'Physics', 'Chemistry',
             'Biology', 'Accountancy', 'Business Studies', 'Economics') THEN 5
           WHEN s.name = 'Environmental Studies' THEN 4
           ELSE 2 END,
         full_marks = 100, pass_marks = 33
       FROM subjects s
       WHERE s.id = cs.subject_id AND cs.academic_year_id = $1`,
      [ids.year],
    );
  });

  // Staff: 30 people, a class teacher for each of the 24 sections.
  const logins: { role: string; who: string; login: string }[] = [
    {
      role: 'Director (school admin)',
      who: 'Rajiv Agarwal',
      login: owner.email!,
    },
  ];
  let accountant = '';
  await step('staff and class teachers', async () => {
    const roles = await get<{ id: string; name: string }[]>(
      admin,
      '/roles?limit=100',
    );
    const roleId = (name: string) => {
      const role = roles.find((r) => r.name === name);
      if (!role) throw new Error(`No system role ${name}`);
      return role.id;
    };
    const office = [
      {
        first: 'Anjali',
        last: 'Mehra',
        key: 'principal',
        roles: ['principal'],
        title: 'Principal',
      },
      {
        first: 'Sanjay',
        last: 'Bhatia',
        key: 'accounts',
        roles: ['accountant'],
        title: 'Accountant',
      },
      {
        first: 'Rekha',
        last: 'Nigam',
        key: 'office',
        roles: ['receptionist'],
        title: 'Office / front desk',
      },
      {
        first: 'Mukesh',
        last: 'Awasthi',
        key: 'library',
        roles: ['librarian'],
        title: 'Librarian',
      },
    ];
    const teacherFirst = [
      'Neelam',
      'Arvind',
      'Shweta',
      'Ravi',
      'Kiran',
      'Pradeep',
      'Madhu',
      'Satish',
      'Preeti',
      'Nadeem',
      'Vandana',
      'Gaurav',
      'Jyoti',
      'Harish',
      'Sarita',
      'Abhishek',
      'Lata',
      'Rajeev',
      'Farah',
      'Manish',
      'Alka',
      'Dinesh',
      'Poonam',
      'Sudhir',
      'Nidhi',
      'Kamal',
    ];
    const teacherLast = [
      'Srivastava',
      'Mishra',
      'Pandey',
      'Tripathi',
      'Saxena',
      'Khanna',
      'Dixit',
      'Shukla',
      'Rizvi',
      'Bhardwaj',
    ];
    for (const [i, p] of office.entries()) {
      const employee = await post(admin, '/employees', {
        firstName: p.first,
        lastName: p.last,
        email: `${p.key}@${EMAIL_DOMAIN}`,
        phone: `90050${String(10_001 + i).slice(-5)}`,
        gender: ['Anjali', 'Rekha'].includes(p.first) ? 'female' : 'male',
        joiningDate: `20${String(10 + i).padStart(2, '0')}-04-01`,
      });
      const invite = await post<{ userId: string }>(
        admin,
        `/employees/${employee.id}/invite`,
        { roleIds: p.roles.map(roleId) },
      );
      await activate(root, invite.userId, orgId);
      logins.push({
        role: p.title,
        who: `${p.first} ${p.last}`,
        login: `${p.key}@${EMAIL_DOMAIN}`,
      });
      if (p.key === 'accounts') {
        accountant = await tokenFor(app, invite.userId, orgId, false);
      }
    }
    const sections = Object.keys(sectionIds);
    await pool(
      teacherFirst.map((first, i) => ({ first, i })),
      CONCURRENCY,
      async ({ first, i }) => {
        const demo = i === sections.indexOf(DEMO_TEACHER_SECTION);
        const employee = await post(admin, '/employees', {
          firstName: first,
          lastName: teacherLast[i % teacherLast.length],
          phone: `90060${String(20_001 + i).slice(-5)}`,
          ...(demo ? { email: `teacher@${EMAIL_DOMAIN}` } : {}),
          joiningDate: `20${String(8 + (i % 15)).padStart(2, '0')}-07-01`,
        });
        if (i < sections.length) {
          await post(admin, '/class-teachers', {
            sectionId: sectionIds[sections[i]],
            employeeId: employee.id,
          });
        }
        if (demo) {
          const invite = await post<{ userId: string }>(
            admin,
            `/employees/${employee.id}/invite`,
            { roleIds: [roleId('teacher'), roleId('class_teacher')] },
          );
          await activate(root, invite.userId, orgId);
          logins.push({
            role: `Class teacher, Class ${DEMO_TEACHER_SECTION.replace(':', ' ')}`,
            who: `${first} ${teacherLast[i % teacherLast.length]}`,
            login: `teacher@${EMAIL_DOMAIN}`,
          });
        }
      },
    );
    // The demo teacher also teaches Mathematics in both Class 5 sections.
    const teacherRow = await root.query<{ id: string }[]>(
      `SELECT id FROM employees WHERE org_id = $1 AND email = $2`,
      [orgId, `teacher@${EMAIL_DOMAIN}`],
    );
    const maths = await root.query<{ id: string }[]>(
      `SELECT cs.id FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id
        WHERE cs.org_id = $1 AND cs.class_id = $2 AND s.name = 'Mathematics'`,
      [orgId, classIds[5]],
    );
    if (teacherRow[0] && maths[0]) {
      for (const s of SECTIONS) {
        await post(admin, '/subject-teachers', {
          sectionId: sectionIds[`5:${s}`],
          classSubjectId: maths[0].id,
          employeeId: teacherRow[0].id,
        });
      }
    }
    // Every other subject of every section has a subject teacher, so the
    // exam overview can say whose mark sheet is missing. A teacher keeps one
    // subject in either the junior (1–5) or senior (6–10) classes.
    const teachers = (
      await root.query<{ id: string }[]>(
        `SELECT id FROM employees
          WHERE org_id = $1 AND phone LIKE '90060%'
            AND (email IS NULL OR email <> $2)
          ORDER BY phone`,
        [orgId, `teacher@${EMAIL_DOMAIN}`],
      )
    ).map((r) => r.id);
    const classSubjects = await root.query<
      { id: string; classId: string; name: string }[]
    >(
      `SELECT cs.id, cs.class_id AS "classId", s.name
         FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id
        WHERE cs.org_id = $1`,
      [orgId],
    );
    const subjectNames = [...new Set(classSubjects.map((c) => c.name))].sort();
    const assignments: {
      sectionId: string;
      classSubjectId: string;
      employeeId: string;
    }[] = [];
    for (let c = 1; c <= CLASSES; c++) {
      for (const cs of classSubjects.filter((x) => x.classId === classIds[c])) {
        for (const s of SECTIONS) {
          if (c === 5 && cs.name === 'Mathematics') continue;
          const sectionId = sectionIds[`${c}:${s}`];
          if (!sectionId) continue;
          const slot = subjectNames.indexOf(cs.name) * 2 + (c > 5 ? 1 : 0);
          assignments.push({
            sectionId,
            classSubjectId: cs.id,
            employeeId: teachers[slot % teachers.length],
          });
        }
      }
    }
    await pool(assignments, CONCURRENCY, (a) =>
      post(admin, '/subject-teachers', a),
    );
    log(`  ${assignments.length + SECTIONS.length} subject teachers`);
  });

  // Fees: class-wise structures, concessions, a late fine.
  const heads: Record<string, string> = {};
  const discount: Record<string, string> = {};
  await step('fee structures, concessions and late fine', async () => {
    for (const h of await get<{ id: string; name: string }[]>(
      admin,
      '/fee-heads',
    )) {
      heads[h.name] = h.id;
    }
    for (let c = 1; c <= CLASSES; c++) {
      await post(admin, '/fee-structures', {
        name: `Class ${c} (2026–27)`,
        academicYearId: ids.year,
        classId: classIds[c],
        items: [
          { feeHeadId: heads['Tuition Fee'], amount: tuition(c) },
          {
            feeHeadId: heads['Computer Fee'],
            amount: c <= 2 ? 20_000 : 40_000,
          },
          {
            feeHeadId: heads['Annual Charges'],
            amount: 1_200_000,
            months: [4],
          },
          { feeHeadId: heads['Development Fee'], amount: 500_000, months: [4] },
          { feeHeadId: heads['Exam Fee'], amount: 80_000, months: [9, 2] },
        ],
      });
    }
    discount.sibling = (
      await post(admin, '/discount-types', {
        name: 'Sibling concession',
        code: 'sibling',
        kind: 'percent',
        value: 1000,
        appliesToHeadIds: [heads['Tuition Fee']],
      })
    ).id;
    discount.staff = (
      await post(admin, '/discount-types', {
        name: 'Staff ward concession',
        code: 'staff_child',
        kind: 'percent',
        value: 5000,
        appliesToHeadIds: [heads['Tuition Fee']],
      })
    ).id;
    discount.rte = (
      await post(admin, '/discount-types', {
        name: 'RTE seat (full waiver)',
        code: 'rte',
        kind: 'percent',
        value: 10000,
      })
    ).id;
    await post(admin, '/late-fine-rules', {
      name: 'Late fee',
      kind: 'fixed',
      amount: 10_000,
      graceDays: 10,
    });
  });

  // Students through the Excel importer, one file per class.
  const { pupils, families } = roster();
  await step(`import ${pupils.length} students`, async () => {
    const template = await api.bytes(admin, '/imports/templates/students');
    for (let c = 1; c <= CLASSES; c++) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(template);
      const ws = wb.worksheets[0];
      const headers = (ws.getRow(1).values as (string | undefined)[]).map((v) =>
        (v ?? '').replace(/ \*$/, ''),
      );
      let next = 2;
      for (const p of pupils.filter((x) => x.cls === c)) {
        const f = families[p.family];
        const values: Record<string, string | number> = {
          'First name': p.first,
          'Last name': f.surname,
          Gender: p.gender,
          'Date of birth': p.dob,
          Religion: ['Khan', 'Siddiqui', 'Ansari'].includes(f.surname)
            ? 'Islam'
            : ['Kohli'].includes(f.surname)
              ? 'Sikh'
              : 'Hindu',
          'Admission date': YEAR_START,
          Class: `Class ${c}`,
          Section: p.section,
          Roll: p.roll,
          ...(c >= 11 ? { Group: STREAM[p.section] } : {}),
          'Father name': `${f.father} ${f.surname}`,
          'Father phone': f.fatherPhone,
          'Father occupation': f.occupation,
          'Mother name': `${f.mother} ${f.surname}`,
          'Mother phone': f.motherPhone,
        };
        const row = ws.getRow(next++);
        headers.forEach((h, k) => {
          if (k > 0) row.getCell(k).value = values[h] ?? null;
        });
        row.commit();
      }
      const form = new FormData();
      form.append('type', 'students');
      form.append('mode', 'all_or_nothing');
      form.append(
        'file',
        new Blob([Buffer.from(await wb.xlsx.writeBuffer())], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        `class-${c}.xlsx`,
      );
      const started = await api.call<{ import: Row; job: Row }>(
        admin,
        'POST',
        '/imports',
        form,
      );
      await waitJob(app, admin, started.job.id);
      const preview = await get<{
        totals: { valid: number; invalid: number };
        rows?: unknown;
      }>(admin, `/imports/${started.import.id}`);
      if (preview.totals.invalid) {
        throw new Error(
          `Import class ${c}: ${JSON.stringify(preview).slice(0, 1500)}`,
        );
      }
      await waitJob(
        app,
        admin,
        (await post(admin, `/imports/${started.import.id}/commit`)).id,
      );
    }
  });

  // Who is who: students with their father's phone (the family key).
  const students = await root.query<
    {
      id: string;
      level: number;
      section: string;
      phone: string;
      enrollment: string;
    }[]
  >(
    `SELECT s.id, c.level, sec.name AS section, g.phone, e.id AS enrollment
       FROM students s
       JOIN student_enrollments e ON e.student_id = s.id AND e.org_id = s.org_id
       JOIN sections sec ON sec.id = e.section_id
       JOIN classes c ON c.id = sec.class_id
       JOIN student_guardians sg ON sg.student_id = s.id AND sg.relation = 'father'
       JOIN guardians g ON g.id = sg.guardian_id
      WHERE s.org_id = $1 AND s.deleted_at IS NULL
      ORDER BY c.level DESC, sec.name, s.admission_number`,
    [orgId],
  );
  const familyOf = new Map<string, number>(
    families.map((f, i) => [`+91${f.fatherPhone}`, i]),
  );

  await step('concessions approved', async () => {
    const seen = new Set<number>();
    const requests: { studentId: string; type: string; reason: string }[] = [];
    for (const s of students) {
      const n = familyOf.get(s.phone);
      if (n === undefined) continue;
      const f = families[n];
      if (f.rte) {
        requests.push({
          studentId: s.id,
          type: discount.rte,
          reason: 'RTE 25% quota admission',
        });
      } else if (f.staffWard) {
        requests.push({
          studentId: s.id,
          type: discount.staff,
          reason: 'Ward of staff member',
        });
      } else if (seen.has(n)) {
        // Students are ordered eldest first: younger siblings get it.
        requests.push({
          studentId: s.id,
          type: discount.sibling,
          reason: 'Sibling studying in the school',
        });
      }
      seen.add(n);
    }
    for (const r of requests) {
      const made = await post(accountant, '/student-discounts', {
        studentId: r.studentId,
        discountTypeId: r.type,
        fromPeriod: '2026-04',
        reason: r.reason,
      });
      await post(admin, `/student-discounts/${made.id}/approve`, {});
    }
    log(`  ${requests.length} concessions`);
  });

  // Invoices April–November.
  const periods = ['04', '05', '06', '07', '08', '09', '10', '11'].map(
    (m) => `2026-${m}`,
  );
  await step('invoices April–November', async () => {
    for (const period of periods) {
      await waitJob(
        app,
        admin,
        (await post(admin, '/invoices/generate', { period })).id,
      );
    }
  });

  // Payment history. Most families pay each month by the 10th; some are
  // behind (one, two or four months: the 0–30 / 31–60 / 60+ groups), a few
  // paid November in part, and some paid November today.
  const backdate: { id: string; on: string }[] = [];
  await step('payments', async () => {
    const invoices = await root.query<
      { student_id: string; period: string; due: number }[]
    >(
      `SELECT student_id, period, (net_total)::bigint AS due FROM invoices
        WHERE org_id = $1 AND status <> 'cancelled' ORDER BY period`,
      [orgId],
    );
    const byStudent = new Map<string, { period: string; due: number }[]>();
    for (const inv of invoices) {
      const list = byStudent.get(inv.student_id) ?? [];
      list.push({ period: inv.period, due: Number(inv.due) });
      byStudent.set(inv.student_id, list);
    }
    const channels = (): string => {
      const x = rand();
      return x < 0.45
        ? 'cash'
        : x < 0.85
          ? 'upi'
          : x < 0.95
            ? 'cheque'
            : 'bank_transfer';
    };
    const plan: {
      studentId: string;
      amount: number;
      on: string;
      channel: string;
    }[] = [];
    let todayCount = 0;
    for (const s of students) {
      const list = (byStudent.get(s.id) ?? []).filter((i) => i.due > 0);
      if (!list.length) continue;
      const x = rand();
      const paidThrough =
        x < 0.7 ? 8 : x < 0.82 ? 7 : x < 0.9 ? 6 : x < 0.95 ? 4 : 7;
      const partial = x >= 0.95;
      for (const [i, inv] of list.entries()) {
        const month = periods.indexOf(inv.period) + 1;
        if (month > paidThrough) {
          if (partial && month === paidThrough + 1) {
            plan.push({
              studentId: s.id,
              amount: Math.round(inv.due / 2 / 100) * 100,
              on: `${inv.period}-${pad(6 + Math.floor(rand() * 8))}`,
              channel: channels(),
            });
          }
          continue;
        }
        let on = `${inv.period}-${pad(2 + Math.floor(rand() * 11))}`;
        if (
          inv.period === '2026-11' &&
          i === list.length - 1 &&
          todayCount < 40 &&
          rand() < 0.12
        ) {
          on = today;
          todayCount++;
        }
        if (on > today) on = today;
        plan.push({
          studentId: s.id,
          amount: inv.due,
          on,
          channel: channels(),
        });
      }
    }
    // Oldest first, so receipt numbers follow the dates.
    plan.sort((a, b) => a.on.localeCompare(b.on));
    await pool(plan, CONCURRENCY, async (p) => {
      // The receipt comes back; it carries its payment's id.
      const receipt = await post<{ paymentId: string }>(admin, '/payments', {
        studentId: p.studentId,
        channel: p.channel,
        amount: p.amount,
        ...(p.channel === 'upi'
          ? {
              reference: `UPI${Math.floor(100_000_000_000 + rand() * 899_999_999_999)}`,
            }
          : p.channel === 'cheque'
            ? { reference: `CHQ ${100_000 + Math.floor(rand() * 899_999)}` }
            : {}),
      });
      if (p.on !== today) backdate.push({ id: receipt.paymentId, on: p.on });
    });
    log(`  ${plan.length} payments, ${todayCount} of them today`);
  });

  await step('payment dates', async () => {
    const pids = backdate.map((b) => b.id);
    const days = backdate.map((b) => b.on);
    // Received mid-morning, school time.
    await root.query(
      `UPDATE payments p SET received_on = d.day::date,
              received_at = (d.day::date + time '10:30') AT TIME ZONE '${TIME_ZONE}'
         FROM unnest($2::uuid[], $3::text[]) AS d(id, day)
        WHERE p.org_id = $1 AND p.id = d.id`,
      [orgId, pids, days],
    );
    await root.query(
      `UPDATE receipts r SET issued_at = p.received_at
         FROM payments p WHERE r.org_id = $1 AND r.payment_id = p.id`,
      [orgId],
    );
    await root.query(
      `UPDATE payment_allocations a SET created_at = p.received_at
         FROM payments p WHERE a.org_id = $1 AND a.payment_id = p.id`,
      [orgId],
    );
    await root.query(
      `UPDATE ledger_entries l SET date = p.received_on
         FROM payments p WHERE l.org_id = $1 AND l.source_id = p.id`,
      [orgId],
    );
  });

  await step('late fines', async () => {
    await app.get(FeeScheduler).runOnce(new Date(), [orgId]);
    await drain(app);
  });

  // Attendance since April, school days only; today too, except Class 5 A.
  await step('attendance history', async () => {
    const holidays = (
      await root.query<{ from: string; to: string }[]>(
        `SELECT to_char(date_from, 'YYYY-MM-DD') AS "from", to_char(date_to, 'YYYY-MM-DD') AS "to"
           FROM holidays WHERE org_id = $1 AND cardinality(class_ids) = 0`,
        [orgId],
      )
    ).map((h) => ({ from: h.from, to: h.to }));
    const days: string[] = [];
    for (let d = YEAR_START; d <= today; d = addDays(d, 1)) {
      const sunday = new Date(`${d}T00:00:00Z`).getUTCDay() === 0;
      if (!sunday && !holidays.some((h) => d >= h.from && d <= h.to))
        days.push(d);
    }
    await root.query(
      `INSERT INTO attendance_registers (id, org_id, section_id, date, period_id, taken_by, submitted_at)
       SELECT gen_random_uuid(), s.org_id, s.id, d, NULL, $3, d + time '08:15'
         FROM sections s CROSS JOIN unnest($2::date[]) AS d
        WHERE s.org_id = $1 AND NOT (s.id = $4 AND d = $5::date)`,
      [orgId, days, owner.id, sectionIds[DEMO_TEACHER_SECTION], today],
    );
    await root.query(
      `INSERT INTO attendance_records (id, org_id, register_id, enrollment_id, status_code, updated_by)
       SELECT gen_random_uuid(), r.org_id, r.id, e.id,
              CASE WHEN x < 0.9 THEN 'present' WHEN x < 0.95 THEN 'absent'
                   WHEN x < 0.98 THEN 'late' ELSE 'leave' END,
              $2
         FROM attendance_registers r
         JOIN student_enrollments e ON e.org_id = r.org_id AND e.section_id = r.section_id
         CROSS JOIN LATERAL (SELECT random() + 0 * length(e.id::text) AS x) rnd
        WHERE r.org_id = $1`,
      [orgId, owner.id],
    );
    log(`  ${days.length} school days`);
    // A few corrections in Class 5 A this month, made the proper way so the
    // register shows who changed what and why.
    const absences = await root.query<
      { enrollment_id: string; date: string }[]
    >(
      `SELECT rec.enrollment_id, to_char(reg.date, 'YYYY-MM-DD') AS date
         FROM attendance_records rec
         JOIN attendance_registers reg ON reg.id = rec.register_id
        WHERE rec.org_id = $1 AND reg.section_id = $2
          AND rec.status_code = 'absent'
          AND reg.date >= date_trunc('month', $3::date) AND reg.date < $3::date
        ORDER BY reg.date DESC
        LIMIT 3`,
      [orgId, sectionIds[DEMO_TEACHER_SECTION], today],
    );
    const reasons = [
      'Arrived after roll call; was in the school bus that came late',
      'Parent sent a medical note the next morning',
      'Marked absent by mistake; was at the inter-school quiz',
    ];
    for (const [i, a] of absences.entries()) {
      await put(
        admin,
        `/attendance/sections/${sectionIds[DEMO_TEACHER_SECTION]}?date=${a.date}`,
        {
          records: [
            {
              enrollmentId: a.enrollment_id,
              status: i === 0 ? 'late' : i === 1 ? 'leave' : 'present',
            },
          ],
          reason: reasons[i],
        },
      );
    }
    log(`  ${absences.length} register corrections`);
  });

  // Half-Yearly exam, classes 1–10: marked, approved, tabulated, published.
  // The demo parent's children are shown in the demo: good results.
  const showcase = new Set(
    students
      .filter((s) => s.phone === `+91${PARENT_PHONE}`)
      .map((s) => s.enrollment),
  );
  await step('Half-Yearly exam', async () => {
    const examId = (
      await post(admin, '/exams', {
        academicYearId: ids.year,
        name: 'Half-Yearly Examination',
      })
    ).id;
    await post(admin, `/exams/${examId}/subjects`, {
      classIds: Array.from({ length: 10 }, (_, i) => classIds[i + 1]),
    });
    await post(admin, `/exams/${examId}/open`);
    const sheets = await get<Row[]>(admin, `/exams/${examId}/mark-sheets`);
    await pool(sheets, CONCURRENCY, async (sheet) => {
      const grid = await get<{
        subject: { components: { id: string; fullMarks: number }[] };
        students: { enrollmentId: string }[];
      }>(admin, `/mark-sheets/${sheet.id}/marks`);
      const entries = grid.students.flatMap((s) =>
        grid.subject.components.map((c) =>
          showcase.has(s.enrollmentId)
            ? {
                enrollmentId: s.enrollmentId,
                componentId: c.id,
                value: Math.round(c.fullMarks * (0.84 + rand() * 0.14)),
              }
            : rand() < 0.01
              ? {
                  enrollmentId: s.enrollmentId,
                  componentId: c.id,
                  absent: true,
                }
              : {
                  enrollmentId: s.enrollmentId,
                  componentId: c.id,
                  // Mostly 55–95%, a few weak results.
                  value: Math.min(
                    c.fullMarks,
                    Math.round(
                      c.fullMarks *
                        (rand() < 0.06
                          ? 0.2 + rand() * 0.2
                          : 0.55 + rand() * 0.42),
                    ),
                  ),
                },
        ),
      );
      // Optional subjects nobody chose have empty sheets; submit them too.
      if (entries.length) {
        await put(admin, `/mark-sheets/${sheet.id}/marks`, { entries });
      }
      await post(admin, `/mark-sheets/${sheet.id}/submit`);
    });
    for (let i = 0; i < sheets.length; i += 500) {
      await post(admin, '/mark-sheets/approve', {
        markSheetIds: sheets.slice(i, i + 500).map((s) => s.id),
      });
    }
    await drain(app);
    const definitions = await get<Row[]>(
      admin,
      `/result-definitions?examId=${examId}`,
    );
    let published = 0;
    for (const d of definitions) {
      try {
        await post(admin, `/result-definitions/${d.id}/publish`);
        published++;
      } catch (err) {
        log(
          `  could not publish ${String(d.id)}: ${(err as Error).message.slice(0, 200)}`,
        );
      }
    }
    log(
      `  ${sheets.length} mark sheets, ${published} of ${definitions.length} results published`,
    );
    // The class teachers' co-scholastic grades and remarks, so the CBSE
    // report cards print complete.
    await root.query(
      `UPDATE results r
          SET co_scholastic = jsonb_build_object(
                'work_education', (ARRAY['A','A','A','B','B','C'])[1 + floor(random() * 6)::int],
                'art_education', (ARRAY['A','A','B','B','B','C'])[1 + floor(random() * 6)::int],
                'health_physical', (ARRAY['A','A','A','B','B','C'])[1 + floor(random() * 6)::int],
                'discipline', (ARRAY['A','A','A','A','B','C'])[1 + floor(random() * 6)::int]),
              remarks = CASE
                WHEN r.percentage >= 85 THEN (ARRAY[
                  'Excellent work. Keep it up!',
                  'A sincere and hardworking student.',
                  'Outstanding performance across subjects.'])[1 + floor(random() * 3)::int]
                WHEN r.percentage >= 60 THEN (ARRAY[
                  'Good progress. Can do even better with regular revision.',
                  'Attentive in class; should practise writing answers.',
                  'Steady effort. Participates well in class activities.'])[1 + floor(random() * 3)::int]
                ELSE (ARRAY[
                  'Needs to give more time to studies at home.',
                  'Should revise daily and ask doubts in class.',
                  'Capable of more; please ensure regular homework.'])[1 + floor(random() * 3)::int]
              END
         FROM result_definitions d
        WHERE d.id = r.result_definition_id AND d.org_id = $1 AND r.org_id = $1`,
      [orgId],
    );
    // Report cards for the demo family's sections, so the parent can open
    // them on the phone.
    for (const key of ['5:A', '8:B']) {
      const [cls] = key.split(':');
      const def = definitions.find(
        (d) => (d as { classId?: string }).classId === classIds[Number(cls)],
      );
      if (!def) continue;
      try {
        const started = await post(
          admin,
          `/result-definitions/${def.id}/report-cards`,
          {
            sectionId: sectionIds[key],
          },
        );
        await waitJob(app, admin, started.id);
      } catch (err) {
        log(
          `  report cards for ${key}: ${(err as Error).message.slice(0, 200)}`,
        );
      }
    }
  });

  // Unit Test 2, still open: most sheets submitted, some saved as drafts,
  // some not started (the exam in-charge chases those). Class 5 A Maths
  // is left empty for the class teacher to fill in during the demo.
  await step('Unit Test 2 (in progress)', async () => {
    const examId = (
      await post(admin, '/exams', {
        academicYearId: ids.year,
        name: 'Unit Test 2',
      })
    ).id;
    await post(admin, `/exams/${examId}/subjects`, {
      classIds: Array.from({ length: 10 }, (_, i) => classIds[i + 1]),
    });
    await post(admin, `/exams/${examId}/open`);
    const sheets = await get<
      (Row & { sectionId: string; subjectName: string })[]
    >(admin, `/exams/${examId}/mark-sheets`);
    let submitted = 0;
    let drafts = 0;
    await pool(sheets, CONCURRENCY, async (sheet) => {
      if (
        sheet.sectionId === sectionIds[DEMO_TEACHER_SECTION] &&
        sheet.subjectName === 'Mathematics'
      ) {
        return;
      }
      const x = rand();
      if (x < 0.15) return; // not started
      const grid = await get<{
        subject: { components: { id: string; fullMarks: number }[] };
        students: { enrollmentId: string }[];
      }>(admin, `/mark-sheets/${sheet.id}/marks`);
      const entries = grid.students.flatMap((st) =>
        grid.subject.components.map((c) => ({
          enrollmentId: st.enrollmentId,
          componentId: c.id,
          value: Math.round(c.fullMarks * (0.5 + rand() * 0.48)),
        })),
      );
      if (entries.length) {
        await put(admin, `/mark-sheets/${sheet.id}/marks`, { entries });
      }
      if (x < 0.3) {
        drafts++;
        return; // saved, not submitted
      }
      await post(admin, `/mark-sheets/${sheet.id}/submit`);
      submitted++;
    });
    log(`  ${sheets.length} sheets: ${submitted} submitted, ${drafts} drafts`);
  });

  // A handful of this week's admissions for the principal's dashboard.
  await root.query(
    `UPDATE students SET admission_date = CURRENT_DATE - (n % 6)::int
       FROM (SELECT id, row_number() OVER (ORDER BY admission_number DESC) AS n
               FROM students WHERE org_id = $1 AND deleted_at IS NULL) x
      WHERE students.id = x.id AND x.n <= 6`,
    [orgId],
  );

  // Months of back-dated payments and reminders are history, not news:
  // mark them sent so parents' feeds (and new reminders) aren't stuck
  // behind thousands of old events. Today's payments still notify.
  await root.query(
    `UPDATE domain_events ev SET processed_at = now()
      WHERE ev.org_id = $1 AND ev.processed_at IS NULL
        AND (ev.type = 'fees.due_reminder'
          OR (ev.type = 'payment.received' AND EXISTS (
                SELECT 1 FROM receipts r JOIN payments p ON p.id = r.payment_id
                 WHERE r.id = (ev.payload->>'receiptId')::uuid
                   AND p.received_on < CURRENT_DATE)))`,
    [orgId],
  );

  // Phase 4: periods and a published timetable for every section, the
  // term's events, homework in Class 5 A, and admission enquiries.
  await step('timetable, calendar, homework and enquiries', async () => {
    const times = [
      ['08:00', '08:45'],
      ['08:45', '09:30'],
      ['09:30', '10:15'],
      ['10:15', '11:00'],
      ['11:20', '12:05'],
      ['12:05', '12:50'],
      ['12:50', '13:35'],
    ];
    const periods = await root.query<{ id: string; display_order: number }[]>(
      `INSERT INTO periods (org_id, name, start_time, end_time, display_order)
       SELECT $1, 'Period ' || n, t[1]::time, t[2]::time, n
         FROM unnest($2::text[]) WITH ORDINALITY AS x(pair, n)
         CROSS JOIN LATERAL (SELECT string_to_array(pair, '-') AS t) p
       RETURNING id, display_order`,
      [orgId, times.map(([a, b]) => `${a}-${b}`)],
    );
    periods.sort((a, b) => a.display_order - b.display_order);
    const teaching = await root.query<
      {
        section_id: string;
        class_id: string;
        academic_year_id: string;
        subject_id: string;
        employee_id: string;
      }[]
    >(
      `SELECT sec.id AS section_id, sec.class_id, sec.academic_year_id,
              cs.subject_id, st.employee_id
         FROM sections sec
         JOIN class_subjects cs
           ON cs.class_id = sec.class_id AND cs.academic_year_id = sec.academic_year_id
         JOIN subject_teachers st
           ON st.section_id = sec.id AND st.class_subject_id = cs.id
          AND st.effective_to IS NULL
        WHERE sec.org_id = $1
        ORDER BY sec.id, cs.id`,
      [orgId],
    );
    const bySection = new Map<string, typeof teaching>();
    for (const r of teaching) {
      bySection.set(r.section_id, [...(bySection.get(r.section_id) ?? []), r]);
    }
    const days = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    const cols: string[][] = [[], [], [], [], [], [], [], []];
    let shift = 0;
    // A teacher is in one class per period: take the rotation's subject,
    // else the next whose teacher is free; no one free leaves it empty.
    const busy = new Set<string>();
    for (const [sectionId, subjects] of bySection) {
      shift++;
      days.forEach((day, d) =>
        periods.forEach((period, p) => {
          const start = d * 3 + p + shift;
          let pick: (typeof subjects)[number] | undefined;
          for (let k = 0; k < subjects.length; k++) {
            const c = subjects[(start + k) % subjects.length];
            if (!busy.has(`${day}:${period.id}:${c.employee_id}`)) {
              pick = c;
              break;
            }
          }
          if (!pick) return;
          busy.add(`${day}:${period.id}:${pick.employee_id}`);
          cols[0].push(orgId);
          cols[1].push(pick.academic_year_id);
          cols[2].push(pick.class_id);
          cols[3].push(sectionId);
          cols[4].push(day);
          cols[5].push(period.id);
          cols[6].push(pick.subject_id);
          cols[7].push(pick.employee_id);
        }),
      );
    }
    await root.query(
      `INSERT INTO class_timetables (org_id, academic_year_id, class_id, section_id,
         day_of_week, period_id, subject_id, employee_id)
       SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::uuid[], $4::uuid[],
         $5::text[], $6::uuid[], $7::uuid[], $8::uuid[])`,
      cols,
    );
    await root.query(
      `INSERT INTO timetable_publications (org_id, section_id, published_at, published_by)
       SELECT $1, id, now(), $2 FROM sections WHERE org_id = $1`,
      [orgId, owner.id],
    );
    log(`  ${cols[0].length} timetable periods in ${bySection.size} sections`);

    // The term's events (PTM, sports day, annual day…).
    const events: [string, string, number, number, boolean, string | null][] = [
      [
        'Parent-teacher meeting',
        'ptm',
        6,
        6,
        true,
        'Meet the class teacher, 9 am to 1 pm. Report cards will be discussed.',
      ],
      [
        'Annual sports day',
        'sports',
        14,
        15,
        true,
        'Track events on day one, team games on day two. Sports uniform.',
      ],
      [
        'Science exhibition',
        'activity',
        24,
        24,
        true,
        'Classes 6 to 10 present their projects in the school hall.',
      ],
      ['Staff meeting: half-yearly review', 'meeting', 3, 3, false, null],
      [
        'Annual day rehearsal',
        'event',
        32,
        34,
        true,
        'Participants stay till 3 pm.',
      ],
      [
        'Annual day',
        'event',
        36,
        36,
        true,
        'Parents are invited. Programme starts 5 pm in the school ground.',
      ],
    ];
    for (const [title, kind, from, to, forParents, description] of events) {
      await root.query(
        `INSERT INTO school_events (org_id, title, description, kind, date_from, date_to, for_parents, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          orgId,
          title,
          description,
          kind,
          addDays(today, from),
          addDays(today, to),
          forParents,
          owner.id,
        ],
      );
    }

    // Homework in Class 5 A: a few due soon, a couple past with submissions.
    const fiveA = sectionIds['5:A'];
    const fiveASubjects = await root.query<{ id: string; name: string }[]>(
      `SELECT cs.id, sub.name FROM class_subjects cs
         JOIN subjects sub ON sub.id = cs.subject_id
         JOIN sections sec ON sec.class_id = cs.class_id AND sec.academic_year_id = cs.academic_year_id
        WHERE sec.id = $1`,
      [fiveA],
    );
    const subjectId = (name: string) =>
      fiveASubjects.find((x) => x.name === name)?.id ?? fiveASubjects[0].id;
    const homework: [string, string, string, number, number][] = [
      [
        'Mathematics',
        'Exercise 6.2: questions 1 to 12',
        'Show all working in your maths notebook.',
        -9,
        -6,
      ],
      [
        'English',
        'Write a letter to your friend about Diwali',
        'About 120 words. Use the format we practised in class.',
        -7,
        -3,
      ],
      [
        'Environmental Studies',
        'Draw and label the water cycle',
        'On an A4 sheet; colour it.',
        -2,
        2,
      ],
      [
        'Mathematics',
        'Fractions worksheet',
        'Complete both sides of the worksheet given in class.',
        -1,
        1,
      ],
      [
        'Hindi',
        'पाठ 7 के प्रश्न-उत्तर लिखें',
        'कॉपी में साफ़-साफ़ लिखें।',
        0,
        3,
      ],
    ];
    const enrolled = await root.query<{ id: string }[]>(
      `SELECT id FROM student_enrollments WHERE section_id = $1 AND status = 'active' ORDER BY roll_no`,
      [fiveA],
    );
    for (const [subject, title, description, set, due] of homework) {
      const [row] = await root.query<{ id: string }[]>(
        `INSERT INTO homework (org_id, section_id, class_subject_id, title, description, assigned_on, due_date, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          orgId,
          fiveA,
          subjectId(subject),
          title,
          description,
          addDays(today, set),
          addDays(today, due),
          owner.id,
        ],
      );
      if (due < 0) {
        // Most handed it in; a few didn't.
        const handed = enrolled.filter((_, i) => i % 7 !== 3 && i % 11 !== 5);
        await root.query(
          `INSERT INTO homework_submissions (org_id, homework_id, enrollment_id, marked_by, marked_at)
           SELECT $1, $2, e, $3, now() FROM unnest($4::uuid[]) AS e`,
          [orgId, row.id, owner.id, handed.map((e) => e.id)],
        );
      }
    }

    // Admission enquiries for next session, at every stage.
    const enquiries: [
      string,
      number,
      string,
      string,
      string,
      string,
      number | null,
      string | null,
    ][] = [
      [
        'Ishaan Malhotra',
        1,
        'Rohit Malhotra',
        '9811100001',
        'walk_in',
        'new',
        1,
        null,
      ],
      [
        'Myra Kapoor',
        1,
        'Neha Kapoor',
        '9811100002',
        'website',
        'new',
        0,
        null,
      ],
      [
        'Vivaan Sethi',
        3,
        'Amit Sethi',
        '9811100003',
        'phone',
        'contacted',
        2,
        null,
      ],
      [
        'Anaya Bhatt',
        6,
        'Kavita Bhatt',
        '9811100004',
        'referral',
        'contacted',
        -1,
        null,
      ],
      [
        'Reyansh Arora',
        2,
        'Sunil Arora',
        '9811100005',
        'walk_in',
        'visited',
        3,
        null,
      ],
      [
        'Kiara Chawla',
        4,
        'Pooja Chawla',
        '9811100006',
        'social',
        'visited',
        0,
        null,
      ],
      [
        'Advait Joshi',
        9,
        'Manish Joshi',
        '9811100007',
        'phone',
        'lost',
        null,
        'Chose a school nearer home',
      ],
      [
        'Saanvi Goel',
        1,
        'Ritu Goel',
        '9811100008',
        'website',
        'new',
        null,
        null,
      ],
    ];
    for (const [
      name,
      cls,
      parent,
      phone,
      source,
      stage,
      follow,
      lost,
    ] of enquiries) {
      await root.query(
        `INSERT INTO enquiries (org_id, student_name, class_id, guardian_name, phone, source, stage, follow_up_on, lost_reason, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now() - (random() * interval '20 days'))`,
        [
          orgId,
          name,
          classIds[cls],
          parent,
          `+91${phone}`,
          source,
          stage,
          follow === null ? null : addDays(today, follow),
          lost,
          owner.id,
        ],
      );
    }
    log(
      `  ${events.length} events, ${homework.length} homework, ${enquiries.length} enquiries`,
    );
  });

  // Phase 5: staff register and leave, substitutes, transport, library
  // and payroll.
  await step('staff attendance, transport, library and payroll', async () => {
    const staff = await root.query<
      { id: string; first_name: string; title: string | null }[]
    >(
      `SELECT e.id, e.first_name, d.title FROM employees e
         LEFT JOIN designations d ON d.id = e.designation_id
        WHERE e.org_id = $1 AND e.status = 'active' ORDER BY e.first_name`,
      [orgId],
    );
    // The last school day on or before today (Sunday off).
    let lastDay = today;
    while (new Date(`${lastDay}T00:00:00Z`).getUTCDay() === 0)
      lastDay = addDays(lastDay, -1);
    const monthStart = `${today.slice(0, 7)}-01`;
    const prevStart = `${addDays(monthStart, -1).slice(0, 7)}-01`;
    await root.query(
      `INSERT INTO staff_attendance (org_id, employee_id, date, status, marked_by)
       SELECT $1, e.id, d::date,
              CASE WHEN r < 0.03 THEN 'absent' WHEN r < 0.07 THEN 'late'
                   WHEN r < 0.08 THEN 'half_day' ELSE 'present' END,
              $2
         FROM employees e
         CROSS JOIN generate_series($3::date, $4::date, interval '1 day') AS d
         CROSS JOIN LATERAL (SELECT random() + 0 * length(e.id::text) + 0 * extract(day from d) AS r) x
        WHERE e.org_id = $1 AND e.status = 'active' AND extract(isodow from d) <> 7`,
      [orgId, owner.id, prevStart, lastDay],
    );
    // Two teachers away on the last school day: one absent, one on leave.
    const byName = (first: string) =>
      staff.find((x) => x.first_name === first)?.id;
    const absent = byName('Jyoti');
    const onLeave = byName('Rajeev');
    if (absent) {
      await put(admin, '/staff-attendance', {
        date: lastDay,
        records: [{ employeeId: absent, status: 'absent' }],
      });
    }
    if (onLeave) {
      await post(admin, '/staff-leaves', {
        employeeId: onLeave,
        fromDate: lastDay,
        leaveType: 'casual',
        reason: 'Family function',
        approved: true,
      });
    }
    const sick = byName('Vandana');
    if (sick) {
      await post(admin, '/staff-leaves', {
        employeeId: sick,
        fromDate: addDays(today, 2),
        toDate: addDays(today, 3),
        leaveType: 'sick',
        reason: 'Doctor advised rest',
      });
    }
    const uncovered = await get<{
      periods: { timetableId: string; free: { id: string }[] }[];
    }>(admin, `/substitutions?date=${lastDay}`);
    const firstGap = uncovered.periods.find((x) => x.free.length);
    if (firstGap) {
      await put(admin, '/substitutions', {
        date: lastDay,
        timetableId: firstGap.timetableId,
        employeeId: firstGap.free[0].id,
      });
    }

    // Transport: three routes in Lucknow, students on their stops.
    const routes: [
      string,
      string,
      string,
      string,
      number,
      [string, string, string][],
    ][] = [
      [
        'Route 1: Gomti Nagar',
        'UP32 AB 1234',
        'Ramesh Yadav',
        '9839012345',
        1200_00,
        [
          ['Patrakarpuram', '07:00', '14:50'],
          ['Vibhuti Khand', '07:08', '14:42'],
          ['Indira Gandhi Pratishthan', '07:16', '14:34'],
          ['Chinhat Tiraha', '07:25', '14:25'],
          ['School gate', '07:40', '14:10'],
        ],
      ],
      [
        'Route 2: Indira Nagar',
        'UP32 CD 5678',
        'Suresh Kumar',
        '9839023456',
        1100_00,
        [
          ['Munshi Pulia', '07:05', '14:45'],
          ['Lekhraj Market', '07:12', '14:38'],
          ['Bhootnath', '07:20', '14:30'],
          ['Kapoorthala', '07:28', '14:22'],
          ['School gate', '07:40', '14:10'],
        ],
      ],
      [
        'Route 3: Aliganj',
        'UP32 EF 9012',
        'Dinesh Pal',
        '9839034567',
        1000_00,
        [
          ['Puraniya', '07:02', '14:48'],
          ['Sector Q', '07:10', '14:40'],
          ['Kursi Road', '07:18', '14:32'],
          ['Kapoorthala Chauraha', '07:27', '14:23'],
          ['School gate', '07:40', '14:10'],
        ],
      ],
    ];
    const stopIds: string[] = [];
    for (const [name, vehicle, driver, phone, fee, stops] of routes) {
      const r = await post<{ stops: { id: string; name: string }[] }>(
        admin,
        '/transport/routes',
        {
          name,
          vehicleNumber: vehicle,
          driverName: driver,
          driverPhone: phone,
          monthlyFee: fee,
          stops: stops.map(([n, pickupTime, dropTime]) => ({
            name: n,
            pickupTime,
            dropTime,
          })),
        },
      );
      stopIds.push(
        ...r.stops.filter((x) => x.name !== 'School gate').map((x) => x.id),
      );
    }
    const riders = await root.query<{ id: string }[]>(
      `SELECT s.id FROM students s
        WHERE s.org_id = $1 AND (
          s.id IN (SELECT sg.student_id FROM student_guardians sg JOIN guardians g ON g.id = sg.guardian_id
                    WHERE g.org_id = $1 AND g.phone = $2)
          OR random() < 0.12)
        LIMIT 90`,
      [orgId, `+91${PARENT_PHONE}`],
    );
    await root.query(
      `INSERT INTO transport_assignments (org_id, student_id, stop_id)
       SELECT $1, s, ($3::uuid[])[1 + (row_number() OVER () % cardinality($3::uuid[]))]
         FROM unnest($2::uuid[]) AS s
       ON CONFLICT DO NOTHING`,
      [orgId, riders.map((r) => r.id), stopIds],
    );
    const billed = await post<{ created: number }>(
      admin,
      '/transport/billing',
      {
        period: today.slice(0, 7),
      },
    );
    log(
      `  ${riders.length} students on 3 routes, ${billed.created} transport bills`,
    );

    // Library: a small catalogue and books out, some overdue.
    const books: [string, string, string, number][] = [
      ['Malgudi Days', 'R. K. Narayan', 'Fiction', 3],
      ['The Blue Umbrella', 'Ruskin Bond', 'Fiction', 3],
      ['Panchatantra Stories', 'Vishnu Sharma', 'Stories', 4],
      ['Wings of Fire', 'A. P. J. Abdul Kalam', 'Biography', 2],
      ['Godaan', 'Munshi Premchand', 'Hindi', 2],
      ['Rusty Runs Away', 'Ruskin Bond', 'Fiction', 2],
      ['Tenali Raman Tales', 'Various', 'Stories', 3],
      ['Discovery of India', 'Jawaharlal Nehru', 'History', 1],
      ['NCERT Science Activity Book', 'NCERT', 'Reference', 3],
      ['Oxford Student Atlas for India', 'Oxford', 'Reference', 2],
      ['Swami and Friends', 'R. K. Narayan', 'Fiction', 2],
      ['Akbar Birbal Stories', 'Various', 'Stories', 3],
    ];
    const accessions: string[] = [];
    for (const [title, author, category, copies] of books) {
      const b = await post<{ accessions: string[] }>(admin, '/library/books', {
        title,
        author,
        category,
        copies,
      });
      accessions.push(b.accessions[0]);
    }
    const readers = await root.query<{ admission_number: string }[]>(
      `SELECT s.admission_number FROM students s
        WHERE s.org_id = $1 AND (
          s.id IN (SELECT sg.student_id FROM student_guardians sg JOIN guardians g ON g.id = sg.guardian_id
                    WHERE g.org_id = $1 AND g.phone = $2)
          OR random() < 0.02)
        LIMIT 12`,
      [orgId, `+91${PARENT_PHONE}`],
    );
    for (const [i, r] of readers.entries()) {
      if (!accessions[i]) break;
      await post(admin, '/library/issues', {
        accessionNo: accessions[i],
        studentId: r.admission_number,
      });
    }
    // Back-date a third of the loans so some are overdue.
    await root.query(
      `UPDATE library_issues SET issued_on = $2::date - 24, due_on = $2::date - 10
        WHERE id IN (SELECT id FROM library_issues WHERE org_id = $1 ORDER BY id LIMIT 4)`,
      [orgId, today],
    );

    // Payroll: everyone's salary, and last month's payroll finalised.
    for (const p of staff) {
      const senior = /principal|head|vice/i.test(p.title ?? '');
      const teacher = /teacher/i.test(p.title ?? '') || !p.title;
      const basic = senior
        ? 55_000_00
        : teacher
          ? 26_000_00 + (p.first_name.length % 5) * 1_500_00
          : 14_000_00;
      await put(admin, `/payroll/structures/${p.id}`, {
        basic,
        hra: Math.round(basic * 0.4),
        da: Math.round(basic * 0.12),
        otherAllowances: teacher || senior ? 2_000_00 : 1_000_00,
        pfApplicable: true,
        esiApplicable: basic * 1.52 + 1_000_00 <= 21_000_00,
        tdsMonthly: senior ? 6_500_00 : basic >= 30_000_00 ? 1_200_00 : 0,
      });
    }
    const run = await post<{ id: string; payslips: unknown[] }>(
      admin,
      '/payroll/runs',
      {
        period: prevStart.slice(0, 7),
      },
    );
    await post(admin, `/payroll/runs/${run.id}/finalize`);
    log(
      `  ${books.length} titles, ${readers.length} loans; payroll for ${prevStart.slice(0, 7)}: ${run.payslips.length} payslips`,
    );
  });

  await step('circulars', async () => {
    await post(admin, '/notices', {
      title: 'Winter break and school timings',
      body:
        'Dear parents, the school will remain closed for winter break from 26 December to 2 January. ' +
        'Classes resume on Monday, 4 January, at the winter timing of 8:30 am to 2:00 pm.',
      audience: { type: 'all' },
      pinned: true,
    });
    await post(admin, '/notices', {
      title: 'Class 10: pre-board examination schedule',
      body:
        'The pre-board examinations for Class 10 begin on 5 January. The date sheet has been ' +
        'shared with students; please make sure your ward revises the full syllabus.',
      audience: { type: 'class', ids: [classIds[10]] },
    });
  });

  // The demo parent signs in with their phone number.
  const [parent] = await root.query<{ id: string }[]>(
    `SELECT u.id FROM users u JOIN memberships m ON m.user_id = u.id AND m.org_id = $1
      WHERE u.phone = $2`,
    [orgId, `+91${PARENT_PHONE}`],
  );
  if (parent) {
    await activate(root, parent.id, orgId);
    // A leave request waiting for the class teacher (the demo approves it).
    const asParent = await tokenFor(app, parent.id, orgId, false);
    const kids = await get<
      { studentId: string; enrollment: { className: string } | null }[]
    >(asParent, '/portal/children');
    const younger = kids.find((k) => k.enrollment?.className === 'Class 5');
    if (younger) {
      await post(asParent, `/portal/children/${younger.studentId}/leave`, {
        fromDate: addDays(today, 2),
        toDate: addDays(today, 3),
        reason: 'Family wedding in Kanpur',
      });
    }
    logins.push({
      role: 'Parent (two children: 5 A and 8 B)',
      who: `${families[0].father} ${families[0].surname}`,
      login: PARENT_PHONE,
    });
  } else {
    log('  the demo parent has no portal account; check the import');
  }

  await root.query('ANALYZE');
  return { logins, students: students.length };
}

async function main() {
  const t = performance.now();
  const { app, root, base } = await boot();
  try {
    const { logins, students } = await seed(app, root, base);
    log(
      `done in ${Math.round((performance.now() - t) / 1000)}s: ${students} students`,
    );
    console.log(
      `\n  ${SCHOOL}: http://${SLUG}.lvh.me:3000  (password for every login: ${PASSWORD})\n`,
    );
    for (const l of logins) {
      console.log(`  ${l.role.padEnd(42)} ${l.who.padEnd(20)} ${l.login}`);
    }
    console.log('');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
