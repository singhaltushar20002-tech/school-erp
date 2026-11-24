import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { Section } from '~/modules/sections/entities/section.entity';

/** A section's timetable is published: parents and students can see it. */
@Entity('timetable_publications')
@Index('uq_timetable_publications_section', ['orgId', 'sectionId'], {
  unique: true,
})
export class TimetablePublication extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section?: Section;

  @Column({ name: 'published_at', type: 'timestamptz' })
  publishedAt: Date;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy: string | null;
}
