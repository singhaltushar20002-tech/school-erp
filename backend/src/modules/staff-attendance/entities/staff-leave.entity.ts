import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';

export const LEAVE_TYPES = ['casual', 'sick', 'earned', 'unpaid'] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

/** A staff member's leave; approved leave marks the register. */
@Entity('staff_leaves')
export class StaffLeave extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Column({ name: 'from_date', type: 'date' })
  fromDate: string;

  @Column({ name: 'to_date', type: 'date' })
  toDate: string;

  @Column({ name: 'leave_type', type: 'varchar', length: 16 })
  leaveType: LeaveType;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: LeaveStatus;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy: string | null;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
