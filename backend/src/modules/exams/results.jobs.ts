import { Injectable } from '@nestjs/common';
import { JobHandler, QUEUES } from '~/shared/queue';
import type { JobContext, JobPayload } from '~/shared/queue';
import { formatNumber, type Numerals } from '~/shared/locale/format';
import { mergePdfs } from '~/shared/pdf/pdf-merge';
import { PdfService } from '~/shared/pdf/pdf.service';
import { writeSheet } from '~/shared/spreadsheet/spreadsheet';
import { AttendanceReportService } from '~/modules/attendance/services/attendance-report.service';
import { FileService } from '~/modules/files/file.service';
import { JobTracker } from '~/modules/jobs/services/job-tracker.service';
import {
  GradingService,
  reportCardFormat,
} from '~/modules/grading/services/grading.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import {
  REPORT_CARDS_JOB,
  RESULT_EXPORT_JOB,
  ResultDocumentService,
  type ReportCardsJobData,
  type ResultExportJobData,
} from './services/result-document.service';
import { TABULATION_JOB } from './services/result-definition.service';
import { ResultDefinitionService } from './services/result-definition.service';
import { type ResultRow, ResultService } from './services/result.service';
import { TabulationService } from './services/tabulation.service';

const LABELS = {
  en: {
    title: 'Progress Report',
    session: 'Session',
    name: 'Name',
    id: 'Student ID',
    class: 'Class',
    section: 'Section',
    roll: 'Roll',
    subject: 'Subject',
    full: 'Full marks',
    obtained: 'Obtained',
    grade: 'Grade',
    point: 'Point',
    fourth: '4th subject',
    total: 'Total',
    gpa: 'GPA',
    result: 'Result',
    passed: 'Passed',
    failed: 'Failed',
    sectionPosition: 'Position in section',
    classPosition: 'Position in class',
    attendance: 'Attendance',
    remarks: 'Remarks',
    absent: 'Absent',
    exempt: 'Exempt',
  },
  hi: {
    title: 'प्रगति पत्र',
    session: 'सत्र',
    name: 'नाम',
    id: 'छात्र आईडी',
    class: 'कक्षा',
    section: 'अनुभाग',
    roll: 'रोल',
    subject: 'विषय',
    full: 'पूर्णांक',
    obtained: 'प्राप्तांक',
    grade: 'ग्रेड',
    point: 'अंक',
    fourth: 'चौथा विषय',
    total: 'योग',
    gpa: 'जीपीए',
    result: 'परिणाम',
    passed: 'उत्तीर्ण',
    failed: 'अनुत्तीर्ण',
    sectionPosition: 'अनुभाग में स्थान',
    classPosition: 'कक्षा में स्थान',
    attendance: 'उपस्थिति',
    remarks: 'टिप्पणी',
    absent: 'अनुपस्थित',
    exempt: 'छूट',
  },
  bn: {
    title: 'অগ্রগতি প্রতিবেদন',
    session: 'শিক্ষাবর্ষ',
    name: 'নাম',
    id: 'শিক্ষার্থী আইডি',
    class: 'শ্রেণি',
    section: 'শাখা',
    roll: 'রোল',
    subject: 'বিষয়',
    full: 'পূর্ণমান',
    obtained: 'প্রাপ্ত নম্বর',
    grade: 'গ্রেড',
    point: 'পয়েন্ট',
    fourth: '৪র্থ বিষয়',
    total: 'মোট',
    gpa: 'জিপিএ',
    result: 'ফলাফল',
    passed: 'উত্তীর্ণ',
    failed: 'অনুত্তীর্ণ',
    sectionPosition: 'শাখায় অবস্থান',
    classPosition: 'শ্রেণিতে অবস্থান',
    attendance: 'উপস্থিতি',
    remarks: 'মন্তব্য',
    absent: 'অনুপস্থিত',
    exempt: 'অব্যাহতি',
  },
} as const;

/** Extra words on the board (CBSE, ICSE, state) report cards. */
const BOARD_LABELS = {
  en: {
    title: 'Report Card',
    code: 'School code',
    admission: 'Admission no.',
    part1: 'Part 1: Scholastic areas',
    part2: 'Part 2: Co-scholastic areas',
    part3: 'Part 3: Discipline',
    marks: 'Marks',
    max: 'Max. marks',
    percentage: 'Percentage',
    division: 'Division',
    overall: 'Overall grade',
    area: 'Area',
    discipline: 'Discipline',
    threePoint: 'A: Outstanding · B: Very good · C: Fair',
    remarks: "Class teacher's remarks",
    scale: 'Grading scale',
    areas: {
      work_education: 'Work education',
      art_education: 'Art education',
      health_physical: 'Health & physical education',
    },
    signatures: {} as Record<string, string>,
  },
  hi: {
    title: 'रिपोर्ट कार्ड',
    code: 'विद्यालय कोड',
    admission: 'प्रवेश संख्या',
    part1: 'भाग 1: शैक्षिक क्षेत्र',
    part2: 'भाग 2: सह-शैक्षिक क्षेत्र',
    part3: 'भाग 3: अनुशासन',
    marks: 'अंक',
    max: 'पूर्णांक',
    percentage: 'प्रतिशत',
    division: 'श्रेणी',
    overall: 'समग्र ग्रेड',
    area: 'क्षेत्र',
    discipline: 'अनुशासन',
    threePoint: 'A: उत्कृष्ट · B: बहुत अच्छा · C: संतोषजनक',
    remarks: 'कक्षा शिक्षक की टिप्पणी',
    scale: 'ग्रेड मापदंड',
    areas: {
      work_education: 'कार्य शिक्षा',
      art_education: 'कला शिक्षा',
      health_physical: 'स्वास्थ्य एवं शारीरिक शिक्षा',
    },
    signatures: {
      'Class teacher': 'कक्षा शिक्षक',
      Guardian: 'अभिभावक',
      Parent: 'अभिभावक',
      'Head teacher': 'प्रधानाचार्य',
      Principal: 'प्रधानाचार्य',
    } as Record<string, string>,
  },
};

const DIVISIONS_HI: Record<string, string> = {
  'First Division': 'प्रथम श्रेणी',
  'Second Division': 'द्वितीय श्रेणी',
  'Third Division': 'तृतीय श्रेणी',
  Fail: 'अनुत्तीर्ण',
};

const BOARD_CSS = `
body{font-size:10pt}
.card{page-break-after:always;padding:3mm}
.card:last-child{page-break-after:auto}
.head{display:flex;align-items:center;gap:4mm;justify-content:center;border-bottom:2px solid #333;padding-bottom:2mm}
.logo{height:20mm}
.head-text{text-align:center}
.school{font-size:17pt;font-weight:bold}
.tagline{font-style:italic;color:#444}
.small{font-size:8.5pt;color:#333}
.title{text-align:center;font-size:13pt;font-weight:bold;margin-top:3mm;letter-spacing:1px}
.sub{text-align:center;color:#444;margin-bottom:2mm}
.info td{padding:1mm 0}
.part{margin-top:3mm;font-weight:bold;background:#eee;padding:1mm 2mm}
.marks{margin-top:1mm}
.marks th,.marks td{border:1px solid #666;padding:1.3mm;text-align:center}
.marks th{background:#f4f4f4}
.marks .subj{text-align:left}
.marks .parts{font-size:8pt;color:#555}
.marks tr.fail td{color:#b00}
.marks tr.total td{font-weight:bold}
.summary{margin-top:2mm}
.summary td{padding:1.5mm;border:1px solid #ccc}
.two{display:flex;gap:4mm}
.two>div{flex:1}
.note{font-size:8pt;color:#555;margin-top:1mm}
.remarks{margin-top:3mm;border:1px solid #ccc;padding:2mm;min-height:10mm}
.scale{margin-top:3mm;font-size:8pt}
.scale td{border:1px solid #ccc;padding:1mm;text-align:center}
.scale .scale-head{font-weight:bold;text-align:left}
.signs{margin-top:6mm}
.signs td{text-align:center;vertical-align:bottom;height:16mm}
.sig{display:block;max-height:12mm;max-width:40mm;margin:0 auto}
.line{border-top:1px solid #000;width:45mm;margin:0 auto 1mm}
.footer{margin-top:2mm;text-align:center;font-size:8pt;color:#555}
`;

const CARD_CSS = `
body{font-size:10pt}
.card{page-break-after:always;padding:4mm}
.card:last-child{page-break-after:auto}
.head{text-align:center;margin-bottom:4mm}
.logo{height:16mm}
.school{font-size:16pt;font-weight:bold}
.school-bn{font-size:12pt}
.title{font-size:13pt;font-weight:bold;margin-top:2mm;text-decoration:underline}
.sub{color:#444}
.info td{padding:1mm 0}
.marks{margin-top:3mm}
.marks th,.marks td{border:1px solid #666;padding:1.5mm;text-align:center}
.marks .subj{text-align:left}
.marks .parts{font-size:8pt;color:#555}
.marks tr.fail td{color:#b00}
.summary{margin-top:3mm}
.summary td{padding:1.5mm;border:1px solid #ccc}
.remarks{margin-top:3mm;border:1px solid #ccc;padding:2mm;min-height:10mm}
.signs{margin-top:4mm}
.signs td{text-align:center;vertical-align:bottom;height:16mm}
.sig{display:block;max-height:12mm;max-width:40mm;margin:0 auto}
.line{border-top:1px solid #000;width:45mm;margin:0 auto 1mm}
`;

const SHEET_CSS = `
body{font-size:8pt}
.head{text-align:center;margin-bottom:3mm}
.school{font-size:13pt;font-weight:bold}
.title{font-size:11pt;font-weight:bold}
.sheet th,.sheet td{border:1px solid #666;padding:1mm;text-align:center}
.sheet th{background:#eee}
.foot{margin-top:2mm;color:#666;font-size:7pt}
`;

/** Results work: tabulation, report cards and result sheets. */
@Injectable()
export class ResultJobs {
  constructor(
    private readonly tracker: JobTracker,
    private readonly pdf: PdfService,
  ) {}

  @JobHandler(QUEUES.academic, TABULATION_JOB)
  tabulate(
    payload: JobPayload<{ resultDefinitionId: string }>,
    context: JobContext,
  ) {
    return this.tracker.run(payload, context, async ({ resolve }) => {
      const tabulation = await resolve(TabulationService);
      return {
        result: {
          ...(await tabulation.tabulate(payload.data.resultDefinitionId)),
        },
      };
    });
  }

  /**
   * One PDF per student (kept on the result) and one for the section,
   * merged from those without rendering again. Renders run in parallel up
   * to `PDF_CONCURRENCY`.
   */
  @JobHandler(QUEUES.pdf, REPORT_CARDS_JOB)
  reportCards(payload: JobPayload<ReportCardsJobData>, context: JobContext) {
    return this.tracker.run(payload, context, async (scope) => {
      const { resolve } = scope;
      const results = await resolve(ResultService);
      const definitions = await resolve(ResultDefinitionService);
      const settings = await resolve(SettingsService);
      const attendance = await resolve(AttendanceReportService);
      const files = await resolve(FileService);
      const { resultDefinitionId, sectionId, language } = payload.data;
      const definition = await definitions.findById(resultDefinitionId);
      const grading = await resolve(GradingService);
      const { system, scheme } = await grading.schemeFor(
        definition.academicYearId,
        definition.classId,
      );
      const format = reportCardFormat(system.templateCode);
      const options = (await settings.getSection('results')).reportCard;
      const school = await settings.getDisplay();
      const rows = (
        await results.rows(resultDefinitionId, sectionId, null)
      ).sort((a, b) => (a.positionSection ?? 1e9) - (b.positionSection ?? 1e9));
      const l = LABELS[language];
      // One query for the whole section's attendance, not one per student.
      const summaries = options.showAttendance
        ? await attendance.enrollmentSummaries(
            definition.academicYearId,
            rows.map((r) => r.enrollmentId),
          )
        : null;
      const cards = rows.map((r) =>
        card(
          r,
          l,
          {
            ...options,
            // Bangla cards use Bangla digits; English ones the school's choice.
            numerals: language === 'bn' ? 'bn' : school.locale.numerals,
          },
          summaries?.get(r.enrollmentId) ?? null,
        ),
      );
      const images = await settings.signatureImages(options.signatureSigners);
      const page = {
        l,
        schoolName: school.name,
        schoolNameBn: school.nameBn,
        logo: null,
        resultName: definition.name,
        session: definition.academicYear?.name ?? '',
        className: definition.schoolClass?.name ?? '',
        showPoint: rows.some((r) => r.gpa !== null),
        signatures: options.signatures.map((label, i) => {
          const signer = options.signatureSigners[i] ?? null;
          return { label, image: signer ? images.get(signer) : undefined };
        }),
      };
      const board = format !== 'standard';
      const b = BOARD_LABELS[language === 'hi' ? 'hi' : 'en'];
      const boardPage = board
        ? {
            ...page,
            b,
            lh: await settings.letterhead(),
            isCbse: format === 'cbse',
            isState: format === 'state',
            showGrade: format !== 'state',
            scale:
              format === 'state'
                ? []
                : scheme.bands
                    .slice()
                    .sort((x, y) => y.minPercent - x.minPercent)
                    .map((band) => ({
                      letter: band.letter,
                      range: `${band.minPercent}–${band.maxPercent}`,
                    })),
            signatures: page.signatures.map((s) => ({
              ...s,
              label: b.signatures[s.label] ?? s.label,
            })),
          }
        : null;
      const boardCards = board
        ? rows.map((r, i) => {
            const base = cards[i];
            const grades = r.coScholastic ?? {};
            const grade =
              language === 'hi' && format === 'state'
                ? (DIVISIONS_HI[r.grade] ?? r.grade)
                : r.grade;
            return {
              ...base,
              grade,
              percentage: formatNumber(
                (Math.round(r.percentage * 10) / 10).toFixed(1),
                school.locale.numerals,
              ),
              remarks: r.remarks ?? '',
              coScholastic: (
                Object.keys(b.areas) as (keyof typeof b.areas)[]
              ).map((area) => ({
                label: b.areas[area],
                grade: grades[area] ?? '',
              })),
              discipline: grades.discipline ?? '',
            };
          })
        : null;
      const render = (list: typeof cards) =>
        boardPage
          ? this.pdf.render(
              'report-cards/board',
              {
                ...boardPage,
                cards: list.map((c) => boardCards![cards.indexOf(c)]),
              },
              { paper: 'A4', css: BOARD_CSS },
            )
          : this.pdf.render(
              'report-cards/cards',
              { ...page, cards: list },
              { paper: 'A4', css: CARD_CSS },
            );

      // Each card renders once; the section's PDF joins those pages.
      let done = 0;
      const pdfs = await Promise.all(
        rows.map(async (r, i) => {
          const buffer = await render([cards[i]]);
          const stored = await files.storeGenerated({
            buffer,
            originalName: `report-card-${r.admissionNumber || r.enrollmentId}.pdf`,
          });
          await results.setReportCard(r.id, stored.id);
          done++;
          await scope.progress((done / Math.max(rows.length, 1)) * 90);
          return buffer;
        }),
      );
      const merged = await files.storeGenerated({
        buffer: pdfs.length ? await mergePdfs(pdfs) : await render([]),
        originalName: `report-cards-${page.className}-${rows[0]?.sectionName ?? ''}.pdf`,
      });
      return { fileId: merged.id, result: { cards: rows.length } };
    });
  }

  @JobHandler(QUEUES.exports, RESULT_EXPORT_JOB)
  exportXlsx(payload: JobPayload<ResultExportJobData>, context: JobContext) {
    return this.export(payload, context);
  }

  @JobHandler(QUEUES.pdf, RESULT_EXPORT_JOB)
  exportPdf(payload: JobPayload<ResultExportJobData>, context: JobContext) {
    return this.export(payload, context);
  }

  private export(
    payload: JobPayload<ResultExportJobData>,
    context: JobContext,
  ) {
    return this.tracker.run(payload, context, async ({ resolve }) => {
      const documents = await resolve(ResultDocumentService);
      const settings = await resolve(SettingsService);
      const files = await resolve(FileService);
      const table = await documents.table(payload.data);
      const pdf = payload.data.format === 'pdf';
      const buffer = pdf
        ? await this.pdf.render(
            'results/sheet',
            {
              schoolName: (await settings.getDisplay()).name,
              title: table.title,
              subtitle: `${table.rows.length} rows`,
              headers: table.headers,
              rows: table.rows.map((r) => table.keys.map((k) => r[k] ?? '')),
              generatedAt: new Date()
                .toISOString()
                .slice(0, 16)
                .replace('T', ' '),
            },
            { paper: 'A4-landscape', margin: '8mm', css: SHEET_CSS },
          )
        : await writeSheet(
            table.keys.map((key, i) => ({ key, header: table.headers[i] })),
            table.rows,
            'Results',
          );
      const stored = await files.storeGenerated({
        buffer,
        originalName: `${payload.data.type}.${pdf ? 'pdf' : 'xlsx'}`,
      });
      return { fileId: stored.id, result: { rows: table.rows.length } };
    });
  }
}

type Labels = (typeof LABELS)[keyof typeof LABELS];

function card(
  r: ResultRow,
  l: Labels,
  options: { showPosition: boolean; showRemarks: boolean; numerals: Numerals },
  attendance: {
    days: number;
    percentage: number | null;
    present: number;
    late: number;
    halfDay: number;
  } | null,
) {
  const n = (v: number | string | null | undefined) =>
    formatNumber(v, options.numerals);
  const extra: { label: string; value: string | number }[] = [];
  if (options.showPosition) {
    if (r.positionSection !== null)
      extra.push({ label: l.sectionPosition, value: n(r.positionSection) });
    if (r.positionClass !== null)
      extra.push({ label: l.classPosition, value: n(r.positionClass) });
  }
  if (attendance && attendance.days) {
    const attended =
      attendance.present + attendance.late + attendance.halfDay / 2;
    extra.push({
      label: l.attendance,
      value: n(
        `${attended} / ${attendance.days} (${attendance.percentage ?? 0}%)`,
      ),
    });
  }
  return {
    name: r.name,
    nameBn: r.nameBn,
    admissionNumber: r.admissionNumber,
    sectionName: r.sectionName,
    rollNo: n(r.rollNo),
    total: n(r.total),
    fullMarks: n(r.fullMarks),
    gpa: r.gpa === null ? '' : n(r.gpa.toFixed(2)),
    grade: r.grade,
    outcome: r.passed ? l.passed : l.failed,
    remarks: options.showRemarks ? r.remarks : null,
    extra,
    subjects: r.subjects.map((s) => ({
      name: s.subjectName,
      isFourth: s.isFourth,
      passed: s.passed,
      parts: n(s.parts),
      fullMarks: s.exempt ? '' : n(s.fullMarks),
      obtained: s.exempt ? l.exempt : s.absent ? l.absent : n(s.marks),
      grade: s.grade ?? '',
      point: s.point === null ? '' : n(s.point.toFixed(2)),
    })),
  };
}
