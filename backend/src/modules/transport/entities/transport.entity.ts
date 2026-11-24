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

/** A bus route with its vehicle, driver and monthly fee. */
@Entity('transport_routes')
@Index('uq_transport_routes_name', ['orgId', 'name'], { unique: true })
export class TransportRoute extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({
    name: 'vehicle_number',
    type: 'varchar',
    length: 24,
    nullable: true,
  })
  vehicleNumber: string | null;

  @Column({ name: 'driver_name', type: 'varchar', length: 80, nullable: true })
  driverName: string | null;

  @Column({ name: 'driver_phone', type: 'varchar', length: 20, nullable: true })
  driverPhone: string | null;

  /** Minor units, billed once a month per student on the route. */
  @Column({
    name: 'monthly_fee',
    type: 'bigint',
    default: 0,
    transformer: MoneyColumn,
  })
  monthlyFee: number;

  @OneToMany(() => TransportStop, (s) => s.route)
  stops?: TransportStop[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** A stop on a route, in order, with its pick-up and drop times. */
@Entity('transport_stops')
export class TransportStop extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'route_id', type: 'uuid' })
  routeId: string;

  @ManyToOne(() => TransportRoute, (r) => r.stops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route?: TransportRoute;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'pickup_time', type: 'time', nullable: true })
  pickupTime: string | null;

  @Column({ name: 'drop_time', type: 'time', nullable: true })
  dropTime: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** The stop a student boards at (one per student). */
@Entity('transport_assignments')
@Index('uq_transport_assignments_student', ['orgId', 'studentId'], {
  unique: true,
})
export class TransportAssignment extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ name: 'stop_id', type: 'uuid' })
  stopId: string;

  @ManyToOne(() => TransportStop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stop_id' })
  stop?: TransportStop;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
