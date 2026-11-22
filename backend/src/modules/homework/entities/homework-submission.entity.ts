import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { Homework } from './homework.entity';

/** A student handed the homework in (no row: not handed in). */
@Entity('homework_submissions')
@Index('uq_homework_submissions', ['orgId', 'homeworkId', 'enrollmentId'], {
  unique: true,
})
export class HomeworkSubmission extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'homework_id', type: 'uuid' })
  homeworkId: string;

  @ManyToOne(() => Homework, (h) => h.submissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'homework_id' })
  homework?: Homework;

  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId: string;

  @Column({ name: 'marked_by', type: 'uuid', nullable: true })
  markedBy: string | null;

  @Column({ name: 'marked_at', type: 'timestamptz' })
  markedAt: Date;
}
