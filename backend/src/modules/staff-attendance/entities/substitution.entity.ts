import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';

/** Who takes an absent teacher's period on a day. */
@Entity('substitutions')
@Index('uq_substitutions', ['orgId', 'date', 'timetableId'], { unique: true })
export class Substitution extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'timetable_id', type: 'uuid' })
  timetableId: string;

  @Column({ name: 'substitute_employee_id', type: 'uuid' })
  substituteEmployeeId: string;

  @Column({ name: 'assigned_by', type: 'uuid', nullable: true })
  assignedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
