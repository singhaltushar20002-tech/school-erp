import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { ClassSubject } from '~/modules/class-curriculum/entities/class-subject.entity';
import { Section } from '~/modules/sections/entities/section.entity';
import { HomeworkSubmission } from './homework-submission.entity';

/** Homework a subject teacher sets for a section, due on a day. */
@Entity('homework')
@Index('idx_homework_section_due', ['orgId', 'sectionId', 'dueDate'])
export class Homework extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section?: Section;

  @Column({ name: 'class_subject_id', type: 'uuid' })
  classSubjectId: string;

  @ManyToOne(() => ClassSubject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_subject_id' })
  classSubject?: ClassSubject;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'assigned_on', type: 'date' })
  assignedOn: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({
    name: 'attachment_file_ids',
    type: 'uuid',
    array: true,
    default: () => "'{}'",
  })
  attachmentFileIds: string[];

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @OneToMany(() => HomeworkSubmission, (s) => s.homework)
  submissions?: HomeworkSubmission[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
