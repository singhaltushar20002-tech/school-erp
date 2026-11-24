import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';

export const SCHOOL_EVENT_KINDS = [
  'event',
  'ptm',
  'activity',
  'sports',
  'meeting',
] as const;
export type SchoolEventKind = (typeof SCHOOL_EVENT_KINDS)[number];

/**
 * Something on the term calendar that isn't a holiday or an exam: a
 * parent-teacher meeting, annual day, sports day, a staff meeting. For the
 * whole school or some classes; staff-only events stay off the portal.
 */
@Entity('school_events')
@Index('idx_school_events_org_dates', ['orgId', 'dateFrom', 'dateTo'])
export class SchoolEvent extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 16 })
  kind: SchoolEventKind;

  @Column({ name: 'date_from', type: 'date' })
  dateFrom: string;

  /** Inclusive; equal to `dateFrom` for one day. */
  @Column({ name: 'date_to', type: 'date' })
  dateTo: string;

  /** Classes it is for; empty = the whole school. */
  @Column({
    name: 'class_ids',
    type: 'uuid',
    array: true,
    default: () => "'{}'",
  })
  classIds: string[];

  /** Shown to parents in the portal (false: staff only). */
  @Column({ name: 'for_parents', type: 'boolean', default: true })
  forParents: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
