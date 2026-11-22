import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';

export const STAFF_STATUSES = [
  'present',
  'absent',
  'late',
  'half_day',
  'leave',
  'unpaid_leave',
] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

/** One staff member's attendance on one day. */
@Entity('staff_attendance')
@Index('uq_staff_attendance', ['orgId', 'employeeId', 'date'], { unique: true })
export class StaffAttendance extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 16 })
  status: StaffStatus;

  @Column({ name: 'marked_by', type: 'uuid', nullable: true })
  markedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
