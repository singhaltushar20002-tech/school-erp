import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { MoneyColumn } from '~/shared/database/numeric-column';
import type { PayLine } from '../payroll-math';

const money = (name: string) => ({
  name,
  type: 'bigint' as const,
  default: 0,
  transformer: MoneyColumn,
});

/** An employee's monthly salary (minor units). */
@Entity('salary_structures')
@Index('uq_salary_structures_employee', ['orgId', 'employeeId'], {
  unique: true,
})
export class SalaryStructure extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Column(money('basic'))
  basic: number;

  @Column(money('hra'))
  hra: number;

  @Column(money('da'))
  da: number;

  @Column(money('other_allowances'))
  otherAllowances: number;

  @Column({ name: 'pf_applicable', type: 'boolean', default: true })
  pfApplicable: boolean;

  @Column({ name: 'esi_applicable', type: 'boolean', default: false })
  esiApplicable: boolean;

  @Column(money('tds_monthly'))
  tdsMonthly: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export type PayrollStatus = 'draft' | 'finalized';

/** A month's payroll: draft until finalised. */
@Entity('payroll_runs')
@Index('uq_payroll_runs_period', ['orgId', 'period'], { unique: true })
export class PayrollRun extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 7 })
  period: string;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: PayrollStatus;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'finalized_at', type: 'timestamptz', nullable: true })
  finalizedAt: Date | null;

  @Column({ name: 'finalized_by', type: 'uuid', nullable: true })
  finalizedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** One employee's pay for a run. */
@Entity('payslips')
@Index('uq_payslips_run_employee', ['orgId', 'runId', 'employeeId'], {
  unique: true,
})
export class Payslip extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'run_id', type: 'uuid' })
  runId: string;

  @ManyToOne(() => PayrollRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run?: PayrollRun;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Column({ name: 'days_in_month', type: 'int' })
  daysInMonth: number;

  @Column({
    name: 'lop_days',
    type: 'numeric',
    precision: 5,
    scale: 1,
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  lopDays: number;

  @Column(money('gross'))
  gross: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  earnings: PayLine[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  deductions: PayLine[];

  @Column(money('total_deductions'))
  totalDeductions: number;

  @Column(money('net'))
  net: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
