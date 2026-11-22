import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QUEUES } from '~/shared/queue';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import type { Job } from '~/modules/jobs/entities/job.entity';
import { JobService } from '~/modules/jobs/services/job.service';
import { StaffAttendanceService } from '~/modules/staff-attendance/staff-attendance.service';
import { CreateRunDto, SalaryStructureDto } from './payroll.dto';
import {
  Payslip,
  PayrollRun,
  SalaryStructure,
} from './entities/payroll.entity';
import { computePay } from './payroll-math';

export const PAYSLIP_PDF_JOB = 'payslip-pdf';

@Injectable()
export class SalaryStructureRepository extends BaseTenantRepository<SalaryStructure> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, SalaryStructure, 'SalaryStructure');
  }
}

@Injectable()
export class PayrollRunRepository extends BaseTenantRepository<PayrollRun> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, PayrollRun, 'PayrollRun');
  }
}

@Injectable()
export class PayslipRepository extends BaseTenantRepository<Payslip> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Payslip, 'Payslip');
  }

  async deleteForRun(runId: string): Promise<void> {
    await this.repo.delete({ runId });
  }
}

/**
 * Payroll: each employee's salary structure, a monthly run that turns it
 * into payslips (loss of pay from the staff register, EPF, ESI, TDS), and
 * payslip PDFs.
 */
@Injectable()
export class PayrollService {
  constructor(
    private readonly structures: SalaryStructureRepository,
    private readonly runs: PayrollRunRepository,
    private readonly payslips: PayslipRepository,
    private readonly staff: StaffAttendanceService,
    private readonly jobs: JobService,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  private userId() {
    return this.context.current().userId ?? null;
  }

  /** Every active staff member with their structure (null: not set). */
  async listStructures() {
    const month = new Date().toISOString().slice(0, 7);
    const people = (await this.staff.month(month)).staff;
    const all = new Map(
      (await this.structures.find()).map((s) => [s.employeeId, s]),
    );
    return people.map((p) => {
      const s = all.get(p.id) ?? null;
      return {
        employeeId: p.id,
        name: p.name,
        employeeNumber: p.employeeNumber,
        designation: p.designation,
        structure: s && {
          basic: s.basic,
          hra: s.hra,
          da: s.da,
          otherAllowances: s.otherAllowances,
          pfApplicable: s.pfApplicable,
          esiApplicable: s.esiApplicable,
          tdsMonthly: s.tdsMonthly,
          gross: s.basic + s.hra + s.da + s.otherAllowances,
        },
      };
    });
  }

  async setStructure(employeeId: string, dto: SalaryStructureDto) {
    const known = (await this.listStructures()).some(
      (p) => p.employeeId === employeeId,
    );
    if (!known) throw new NotFoundException('Staff member not found');
    const existing = await this.structures.findOne({ where: { employeeId } });
    const values = {
      basic: dto.basic,
      hra: dto.hra ?? 0,
      da: dto.da ?? 0,
      otherAllowances: dto.otherAllowances ?? 0,
      pfApplicable: dto.pfApplicable ?? true,
      esiApplicable: dto.esiApplicable ?? false,
      tdsMonthly: dto.tdsMonthly ?? 0,
    };
    if (existing) {
      Object.assign(existing, values);
      await this.structures.save(existing);
    } else {
      await this.structures.saveNew({ employeeId, ...values });
    }
    return (await this.listStructures()).find(
      (p) => p.employeeId === employeeId,
    );
  }

  async listRuns() {
    const runs = await this.runs.find({ order: { period: 'DESC' } });
    const totals = await this.ds
      .getManager()
      .query<{ run_id: string; n: string; gross: string; net: string }[]>(
        `SELECT run_id, count(*) AS n, sum(gross) AS gross, sum(net) AS net
         FROM payslips WHERE org_id = $1 GROUP BY run_id`,
        [this.ds.orgId],
      );
    return runs.map((r) => {
      const t = totals.find((x) => x.run_id === r.id);
      return {
        ...r,
        employees: Number(t?.n ?? 0),
        gross: Number(t?.gross ?? 0),
        net: Number(t?.net ?? 0),
      };
    });
  }

  private async compute(run: PayrollRun) {
    const month = await this.staff.month(run.period);
    const structures = new Map(
      (await this.structures.find()).map((s) => [s.employeeId, s]),
    );
    await this.payslips.deleteForRun(run.id);
    for (const p of month.staff) {
      const s = structures.get(p.id);
      if (!s) continue;
      const pay = computePay(s, month.daysInMonth, p.lopDays);
      await this.payslips.saveNew({
        runId: run.id,
        employeeId: p.id,
        daysInMonth: month.daysInMonth,
        lopDays: p.lopDays,
        ...pay,
      });
    }
  }

  async createRun(dto: CreateRunDto) {
    const existing = await this.runs.findOne({ where: { period: dto.period } });
    if (existing) {
      throw new ConflictException({
        message: `Payroll for ${dto.period} already exists`,
        code: 'PAYROLL_EXISTS',
      });
    }
    const run = await this.ds.runInTransaction(async () => {
      const r = await this.runs.saveNew({
        period: dto.period,
        status: 'draft',
        createdBy: this.userId(),
        finalizedAt: null,
        finalizedBy: null,
      });
      await this.compute(r);
      return r;
    });
    return this.run(run.id);
  }

  private async draft(id: string) {
    const run = await this.runs.findById(id);
    if (!run) throw new NotFoundException(`Payroll run "${id}" not found`);
    if (run.status !== 'draft') {
      throw new ConflictException({
        message: 'This payroll is finalised',
        code: 'PAYROLL_FINALIZED',
      });
    }
    return run;
  }

  async recalculate(id: string) {
    const run = await this.draft(id);
    await this.ds.runInTransaction(() => this.compute(run));
    return this.run(id);
  }

  async finalize(id: string) {
    const run = await this.draft(id);
    run.status = 'finalized';
    run.finalizedAt = new Date();
    run.finalizedBy = this.userId();
    await this.runs.save(run);
    return this.run(id);
  }

  async run(id: string) {
    const run = await this.runs.findById(id);
    if (!run) throw new NotFoundException(`Payroll run "${id}" not found`);
    const people = new Map(
      (await this.staff.month(run.period)).staff.map((p) => [p.id, p]),
    );
    const slips = await this.payslips.find({ where: { runId: id } });
    return {
      ...run,
      payslips: slips
        .map((s) => ({
          ...s,
          name: people.get(s.employeeId)?.name ?? '',
          designation: people.get(s.employeeId)?.designation ?? null,
          employeeNumber: people.get(s.employeeId)?.employeeNumber ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  async payslip(id: string) {
    const slip = await this.payslips.findOne({
      where: { id },
      relations: { run: true },
    });
    if (!slip) throw new NotFoundException(`Payslip "${id}" not found`);
    const person = (await this.staff.month(slip.run!.period)).staff.find(
      (p) => p.id === slip.employeeId,
    );
    return { ...slip, person };
  }

  async startPayslipPdf(id: string): Promise<Job> {
    await this.payslip(id);
    return this.jobs.start<{ payslipId: string }>({
      type: 'payroll.payslip_pdf',
      queue: QUEUES.pdf,
      name: PAYSLIP_PDF_JOB,
      data: { payslipId: id },
    });
  }
}
