import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { InvoiceService } from '~/modules/fees/services/invoice.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { StudentService } from '~/modules/students/services/student.service';
import {
  TransportAssignment,
  TransportRoute,
  TransportStop,
} from './entities/transport.entity';
import { CreateRouteDto, UpdateRouteDto } from './transport.dto';

@Injectable()
export class TransportRouteRepository extends BaseTenantRepository<TransportRoute> {
  constructor(
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {
    super(ds, TransportRoute, 'TransportRoute');
  }

  sql<T>(query: string, params: unknown[]): Promise<T> {
    return this.ds.getManager().query<T>(query, [this.orgId, ...params]);
  }
}

@Injectable()
export class TransportStopRepository extends BaseTenantRepository<TransportStop> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, TransportStop, 'TransportStop');
  }
}

@Injectable()
export class TransportAssignmentRepository extends BaseTenantRepository<TransportAssignment> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, TransportAssignment, 'TransportAssignment');
  }
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);
const minutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export interface LivePosition {
  /** Which trip the bus is on now (morning pick-up or afternoon drop). */
  trip: 'pickup' | 'drop' | null;
  status: 'waiting' | 'running' | 'done';
  /** The stop just passed (-1 before the first). */
  atStop: number;
  /** 0–1 of the way to the next stop. */
  progress: number;
  time: string;
  /** No GPS yet: the position comes from the stop timings. */
  simulated: true;
}

/**
 * Bus routes, their stops and the students on each stop; transport fees
 * billed monthly as their own bills; and a simulated live position from
 * the stop timings (until GPS devices are fitted).
 */
@Injectable()
export class TransportService {
  constructor(
    private readonly routes: TransportRouteRepository,
    private readonly stops: TransportStopRepository,
    private readonly assignments: TransportAssignmentRepository,
    private readonly students: StudentService,
    private readonly invoices: InvoiceService,
    private readonly settings: SettingsService,
  ) {}

  private stopView(s: TransportStop, students = 0) {
    return {
      id: s.id,
      name: s.name,
      pickupTime: hhmm(s.pickupTime),
      dropTime: hhmm(s.dropTime),
      sortOrder: s.sortOrder,
      students,
    };
  }

  async list() {
    const routes = await this.routes.find({
      relations: { stops: true },
      order: { name: 'ASC' },
    });
    const counts = new Map(
      (
        await this.routes.sql<{ stop_id: string; n: string }[]>(
          `SELECT stop_id, count(*) AS n FROM transport_assignments
            WHERE org_id = $1 GROUP BY stop_id`,
          [],
        )
      ).map((r) => [r.stop_id, Number(r.n)]),
    );
    return routes.map((r) => {
      const stops = (r.stops ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => this.stopView(s, counts.get(s.id) ?? 0));
      return {
        id: r.id,
        name: r.name,
        vehicleNumber: r.vehicleNumber,
        driverName: r.driverName,
        driverPhone: r.driverPhone,
        monthlyFee: r.monthlyFee,
        stops,
        students: stops.reduce((n, s) => n + s.students, 0),
      };
    });
  }

  private async find(id: string) {
    const route = await this.routes.findOne({
      where: { id },
      relations: { stops: true },
    });
    if (!route) throw new NotFoundException(`Route "${id}" not found`);
    return route;
  }

  private async replaceStops(
    route: TransportRoute,
    stops: CreateRouteDto['stops'],
  ) {
    if (!stops) return;
    const existing = route.stops ?? [];
    const kept = new Set<string>();
    for (const [i, s] of stops.entries()) {
      const match = existing.find(
        (e) =>
          e.name.trim().toLowerCase() === s.name.trim().toLowerCase() &&
          !kept.has(e.id),
      );
      if (match) {
        kept.add(match.id);
        match.name = s.name.trim();
        match.pickupTime = s.pickupTime ?? null;
        match.dropTime = s.dropTime ?? null;
        match.sortOrder = i;
        await this.stops.save(match);
      } else {
        await this.stops.saveNew({
          routeId: route.id,
          name: s.name.trim(),
          pickupTime: s.pickupTime ?? null,
          dropTime: s.dropTime ?? null,
          sortOrder: i,
        });
      }
    }
    for (const e of existing) if (!kept.has(e.id)) await this.stops.remove(e);
  }

  async create(dto: CreateRouteDto) {
    const route = await this.routes.saveNew({
      name: dto.name.trim(),
      vehicleNumber: dto.vehicleNumber?.trim() || null,
      driverName: dto.driverName?.trim() || null,
      driverPhone: dto.driverPhone?.trim() || null,
      monthlyFee: dto.monthlyFee,
    });
    await this.replaceStops({ ...route, stops: [] }, dto.stops ?? []);
    return (await this.list()).find((r) => r.id === route.id);
  }

  async update(id: string, dto: UpdateRouteDto) {
    const route = await this.find(id);
    if (dto.name !== undefined) route.name = dto.name.trim();
    if (dto.vehicleNumber !== undefined)
      route.vehicleNumber = dto.vehicleNumber?.trim() || null;
    if (dto.driverName !== undefined)
      route.driverName = dto.driverName?.trim() || null;
    if (dto.driverPhone !== undefined)
      route.driverPhone = dto.driverPhone?.trim() || null;
    if (dto.monthlyFee !== undefined) route.monthlyFee = dto.monthlyFee;
    const stops = route.stops;
    delete route.stops;
    await this.routes.save(route);
    await this.replaceStops({ ...route, stops }, dto.stops);
    return (await this.list()).find((r) => r.id === id);
  }

  async remove(id: string) {
    const route = await this.find(id);
    delete route.stops;
    await this.routes.remove(route);
  }

  /** Students on a route, by stop. */
  async students_(routeId: string) {
    await this.find(routeId);
    const rows = await this.routes.sql<
      {
        student_id: string;
        name: string;
        admission_number: string;
        class_name: string | null;
        section_name: string | null;
        stop_id: string;
      }[]
    >(
      `SELECT s.id AS student_id,
              concat_ws(' ', s.first_name, s.middle_name, s.last_name) AS name,
              s.admission_number, c.name AS class_name, sec.name AS section_name,
              a.stop_id
         FROM transport_assignments a
         JOIN transport_stops st ON st.id = a.stop_id
         JOIN students s ON s.id = a.student_id
         LEFT JOIN student_enrollments e ON e.student_id = s.id AND e.status = 'active'
         LEFT JOIN sections sec ON sec.id = e.section_id
         LEFT JOIN classes c ON c.id = sec.class_id
        WHERE a.org_id = $1 AND st.route_id = $2
        ORDER BY st.sort_order, c.level, s.first_name`,
      [routeId],
    );
    return rows.map((r) => ({
      studentId: r.student_id,
      name: r.name,
      admissionNumber: r.admission_number,
      className: r.class_name,
      sectionName: r.section_name,
      stopId: r.stop_id,
    }));
  }

  async assign(studentId: string, stopId: string) {
    await this.students.findById(studentId);
    const stop = await this.stops.findById(stopId);
    if (!stop) throw new NotFoundException('Stop not found');
    const existing = await this.assignments.findOne({ where: { studentId } });
    if (existing) {
      existing.stopId = stopId;
      delete existing.stop;
      await this.assignments.save(existing);
    } else {
      await this.assignments.saveNew({ studentId, stopId });
    }
    return { studentId, stopId };
  }

  async unassign(studentId: string) {
    const existing = await this.assignments.findOne({ where: { studentId } });
    if (existing) await this.assignments.remove(existing);
  }

  /**
   * One bill per student on a route for the month (the route's fee);
   * students already billed for that month are skipped.
   */
  async bill(period: string) {
    const rows = await this.routes.sql<
      { student_id: string; fee: string; route_name: string; billed: boolean }[]
    >(
      `SELECT a.student_id, r.monthly_fee AS fee, r.name AS route_name,
              EXISTS (SELECT 1 FROM invoices i
                       WHERE i.org_id = $1 AND i.student_id = a.student_id
                         AND i.note = $2 AND i.status <> 'cancelled') AS billed
         FROM transport_assignments a
         JOIN transport_stops st ON st.id = a.stop_id
         JOIN transport_routes r ON r.id = st.route_id
        WHERE a.org_id = $1`,
      [`Transport fee ${period}`],
    );
    const today = await this.settings.today();
    const due = `${period}-10` < today ? today : `${period}-10`;
    let created = 0;
    let skipped = 0;
    for (const r of rows) {
      if (r.billed || Number(r.fee) <= 0) {
        skipped++;
        continue;
      }
      try {
        await this.invoices.create({
          studentId: r.student_id,
          dueDate: due,
          note: `Transport fee ${period}`,
          lines: [
            {
              description: `Transport fee ${period} (${r.route_name})`,
              amount: Number(r.fee),
            },
          ],
        });
        created++;
      } catch {
        skipped++; // e.g. not enrolled this session
      }
    }
    return { period, created, skipped };
  }

  /** Where the bus is, from its stop timings (simulated). */
  async live(routeId: string): Promise<LivePosition> {
    const route = await this.find(routeId);
    const { timeZone } = await this.settings.getSection('locale');
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
    const now = minutes(time);
    const stops = (route.stops ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const trip = (key: 'pickupTime' | 'dropTime') =>
      stops
        .map((s) => s[key])
        .filter((t): t is string => Boolean(t))
        .map((t) => minutes(t.slice(0, 5)));
    const pickup = trip('pickupTime');
    const drop = trip('dropTime');
    const position = (
      kind: 'pickup' | 'drop',
      times: number[],
    ): Omit<LivePosition, 'simulated'> | null => {
      if (times.length < 2) return null;
      const first = times[0];
      const last = times[times.length - 1];
      if (now < first - 15 || now > last + 15) return null;
      if (now < first)
        return { trip: kind, status: 'waiting', atStop: -1, progress: 0, time };
      if (now >= last)
        return {
          trip: kind,
          status: 'done',
          atStop: times.length - 1,
          progress: 0,
          time,
        };
      const i = times.findIndex((t, k) => now >= t && now < times[k + 1]);
      const span = times[i + 1] - times[i] || 1;
      return {
        trip: kind,
        status: 'running',
        atStop: i,
        progress: Math.min(1, (now - times[i]) / span),
        time,
      };
    };
    // Outside the school run, replay the morning trip on a loop so the
    // demo always shows a moving bus.
    const replay = (): Omit<LivePosition, 'simulated'> | null => {
      if (pickup.length < 2) return null;
      const length = pickup[pickup.length - 1] - pickup[0];
      if (length <= 0) return null;
      const t = pickup[0] + (now % (length + 5));
      const i = pickup.findIndex((p, k) => t >= p && t < pickup[k + 1]);
      if (i < 0) {
        return {
          trip: 'pickup',
          status: 'done',
          atStop: pickup.length - 1,
          progress: 0,
          time,
        };
      }
      return {
        trip: 'pickup',
        status: 'running',
        atStop: i,
        progress: Math.min(
          1,
          (t - pickup[i]) / (pickup[i + 1] - pickup[i] || 1),
        ),
        time,
      };
    };
    const result = position('pickup', pickup) ??
      position('drop', drop) ??
      replay() ?? {
        trip: null,
        status: 'waiting' as const,
        atStop: -1,
        progress: 0,
        time,
      };
    return { ...result, simulated: true };
  }

  /** A student's route, stop and the bus right now (for the portal). */
  async forStudent(studentId: string) {
    const a = await this.assignments.findOne({
      where: { studentId },
      relations: { stop: true },
    });
    if (!a?.stop) return null;
    const route = (await this.list()).find((r) => r.id === a.stop!.routeId);
    if (!route) return null;
    return {
      route,
      stopId: a.stopId,
      live: await this.live(route.id),
    };
  }
}
