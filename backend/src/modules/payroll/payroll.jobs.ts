import { Injectable } from '@nestjs/common';
import { JobHandler, QUEUES } from '~/shared/queue';
import type { JobContext, JobPayload } from '~/shared/queue';
import { formatMoney } from '~/shared/locale/format';
import { PdfService } from '~/shared/pdf/pdf.service';
import { FileService } from '~/modules/files/file.service';
import { JobTracker } from '~/modules/jobs/services/job-tracker.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { PAYSLIP_PDF_JOB, PayrollService } from './payroll.service';

const CSS = `
body{font-size:10pt}
.slip{max-width:180mm;margin:0 auto}
.head{display:flex;gap:4mm;align-items:center;border-bottom:2px solid #333;padding-bottom:2mm}
.logo{height:16mm}.school{font-size:15pt;font-weight:bold}.small{font-size:8.5pt;color:#444}
.title{text-align:center;font-size:12pt;font-weight:bold;margin:4mm 0 2mm}
.info td{padding:1mm 0}
.pay{margin-top:3mm}.pay th,.pay td{border:1px solid #888;padding:1.5mm}
.pay th{background:#eee;text-align:left}.r{text-align:right}
.total td{font-weight:bold}
.net{margin-top:4mm;font-size:12pt;text-align:right}
.foot{margin-top:8mm;font-size:8pt;color:#666;text-align:center}
`;

/** Payslip PDFs. */
@Injectable()
export class PayrollJobs {
  constructor(
    private readonly tracker: JobTracker,
    private readonly pdf: PdfService,
  ) {}

  @JobHandler(QUEUES.pdf, PAYSLIP_PDF_JOB)
  payslip(payload: JobPayload<{ payslipId: string }>, context: JobContext) {
    return this.tracker.run(payload, context, async ({ resolve }) => {
      const payroll = await resolve(PayrollService);
      const settings = await resolve(SettingsService);
      const files = await resolve(FileService);
      const slip = await payroll.payslip(payload.data.payslipId);
      const { currency, numerals } = await settings.getSection('locale');
      const money = (n: number) => formatMoney(n, { currency, numerals });
      const rows = Array.from(
        { length: Math.max(slip.earnings.length, slip.deductions.length) },
        (_, i) => ({
          e: slip.earnings[i]?.label ?? '',
          ea: slip.earnings[i] ? money(slip.earnings[i].amount) : '',
          d: slip.deductions[i]?.label ?? '',
          da: slip.deductions[i] ? money(slip.deductions[i].amount) : '',
        }),
      );
      const [y, m] = slip.run!.period.split('-').map(Number);
      const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-IN', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
      const buffer = await this.pdf.render(
        'payroll/payslip',
        {
          lh: await settings.letterhead(),
          month,
          name: slip.person?.name ?? '',
          employeeNumber: slip.person?.employeeNumber ?? '—',
          designation: slip.person?.designation ?? '—',
          days: slip.daysInMonth,
          lop: slip.lopDays,
          rows,
          gross: money(slip.gross),
          deductions: money(slip.totalDeductions),
          net: money(slip.net),
        },
        { paper: 'A4', css: CSS },
      );
      const stored = await files.storeGenerated({
        buffer,
        originalName: `payslip-${slip.run!.period}-${slip.person?.employeeNumber ?? slip.employeeId}.pdf`,
      });
      return { fileId: stored.id };
    });
  }
}
