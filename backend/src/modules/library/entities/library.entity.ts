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
import { MoneyColumn } from '~/shared/database/numeric-column';

/** A title in the library catalogue. */
@Entity('library_books')
export class LibraryBook extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  author: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  isbn: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  category: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  publisher: string | null;

  @OneToMany(() => LibraryCopy, (c) => c.book)
  copies?: LibraryCopy[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export type CopyStatus = 'available' | 'issued' | 'lost';

/** One physical copy, by its accession number. */
@Entity('library_copies')
@Index('uq_library_copies_accession', ['orgId', 'accessionNo'], {
  unique: true,
})
export class LibraryCopy extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'book_id', type: 'uuid' })
  bookId: string;

  @ManyToOne(() => LibraryBook, (b) => b.copies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book?: LibraryBook;

  @Column({ name: 'accession_no', type: 'varchar', length: 24 })
  accessionNo: string;

  @Column({ type: 'varchar', length: 16, default: 'available' })
  status: CopyStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** A copy lent to a student, and its return (with any late fine). */
@Entity('library_issues')
export class LibraryIssue extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'copy_id', type: 'uuid' })
  copyId: string;

  @ManyToOne(() => LibraryCopy, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'copy_id' })
  copy?: LibraryCopy;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ name: 'issued_on', type: 'date' })
  issuedOn: string;

  @Column({ name: 'due_on', type: 'date' })
  dueOn: string;

  @Column({ name: 'returned_on', type: 'date', nullable: true })
  returnedOn: string | null;

  /** Minor units; billed to the student when above zero. */
  @Column({ type: 'bigint', default: 0, transformer: MoneyColumn })
  fine: number;

  @Column({ name: 'fine_invoice_id', type: 'uuid', nullable: true })
  fineInvoiceId: string | null;

  @Column({ name: 'issued_by', type: 'uuid', nullable: true })
  issuedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
