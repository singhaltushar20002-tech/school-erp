import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';

export const ENQUIRY_STAGES = [
  'new',
  'contacted',
  'visited',
  'admitted',
  'lost',
] as const;
export type EnquiryStage = (typeof ENQUIRY_STAGES)[number];

export const ENQUIRY_SOURCES = [
  'walk_in',
  'phone',
  'website',
  'referral',
  'social',
  'other',
] as const;
export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];

/**
 * An admission enquiry from a family, followed up through visits until the
 * child is admitted (then it points at the new student) or the family is
 * lost.
 */
@Entity('enquiries')
@Index('idx_enquiries_org_stage', ['orgId', 'stage'])
export class Enquiry extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_name', type: 'varchar', length: 160 })
  studentName: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  gender: string | null;

  /** The class applied for. */
  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @Column({ name: 'guardian_name', type: 'varchar', length: 160 })
  guardianName: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  email: string | null;

  @Column({
    name: 'previous_school',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  previousSchool: string | null;

  @Column({ type: 'varchar', length: 16 })
  source: EnquirySource;

  @Column({ type: 'varchar', length: 16, default: 'new' })
  stage: EnquiryStage;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'follow_up_on', type: 'date', nullable: true })
  followUpOn: string | null;

  @Column({ name: 'lost_reason', type: 'text', nullable: true })
  lostReason: string | null;

  @Column({ name: 'admitted_student_id', type: 'uuid', nullable: true })
  admittedStudentId: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
