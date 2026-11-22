import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { normalizePhone } from '~/common/identity/identifier';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { ClassService } from '~/modules/classes/class.service';
import { StudentService } from '~/modules/students/services/student.service';
import {
  CreateEnquiryDto,
  FilterEnquiryDto,
  UpdateEnquiryDto,
} from './dto/enquiry.dto';
import { ENQUIRY_STAGES, Enquiry } from './entities/enquiry.entity';
import { EnquiryRepository } from './enquiry.repository';

/**
 * Admission enquiries (walk-ins, calls, the website) and their follow-up
 * until the child is admitted or the family is lost.
 */
@Injectable()
export class EnquiryService {
  constructor(
    private readonly enquiries: EnquiryRepository,
    private readonly classes: ClassService,
    private readonly students: StudentService,
    private readonly context: RequestContext,
  ) {}

  async list(filter: FilterEnquiryDto) {
    const all = await this.enquiries.findRecent();
    const classes = new Map(
      (await this.classes.findAllOrdered()).map((c) => [c.id, c.name]),
    );
    const q = filter.q?.trim().toLowerCase();
    const counts = Object.fromEntries(ENQUIRY_STAGES.map((s) => [s, 0]));
    for (const e of all) counts[e.stage]++;
    const items = all
      .filter((e) => !filter.stage || e.stage === filter.stage)
      .filter(
        (e) =>
          !q ||
          e.studentName.toLowerCase().includes(q) ||
          e.guardianName.toLowerCase().includes(q) ||
          e.phone.includes(q),
      )
      .map((e) => ({
        ...e,
        className: e.classId ? (classes.get(e.classId) ?? null) : null,
      }));
    return { counts, items };
  }

  async findById(id: string): Promise<Enquiry> {
    const e = await this.enquiries.findById(id);
    if (!e) throw new NotFoundException(`Enquiry "${id}" not found`);
    return e;
  }

  private phone(input: string): string {
    const p = normalizePhone(input);
    if (!p) {
      throw new BadRequestException({
        message: 'That phone number is not valid',
        code: 'INVALID_PHONE',
      });
    }
    return p;
  }

  async create(dto: CreateEnquiryDto): Promise<Enquiry> {
    if (dto.classId) await this.classes.findById(dto.classId);
    return this.enquiries.saveNew({
      studentName: dto.studentName.trim(),
      dateOfBirth: dto.dateOfBirth ?? null,
      gender: dto.gender ?? null,
      classId: dto.classId ?? null,
      guardianName: dto.guardianName.trim(),
      phone: this.phone(dto.phone),
      email: dto.email?.trim().toLowerCase() || null,
      previousSchool: dto.previousSchool?.trim() || null,
      source: dto.source,
      stage: 'new',
      notes: dto.notes?.trim() || null,
      followUpOn: dto.followUpOn ?? null,
      lostReason: null,
      admittedStudentId: null,
      createdBy: this.context.current().userId ?? null,
    });
  }

  async update(id: string, dto: UpdateEnquiryDto): Promise<Enquiry> {
    const e = await this.findById(id);
    if (dto.classId) await this.classes.findById(dto.classId);
    if (dto.admittedStudentId)
      await this.students.findById(dto.admittedStudentId);
    if (dto.studentName !== undefined) e.studentName = dto.studentName.trim();
    if (dto.dateOfBirth !== undefined) e.dateOfBirth = dto.dateOfBirth ?? null;
    if (dto.gender !== undefined) e.gender = dto.gender ?? null;
    if (dto.classId !== undefined) e.classId = dto.classId ?? null;
    if (dto.guardianName !== undefined)
      e.guardianName = dto.guardianName.trim();
    if (dto.phone !== undefined) e.phone = this.phone(dto.phone);
    if (dto.email !== undefined)
      e.email = dto.email?.trim().toLowerCase() || null;
    if (dto.previousSchool !== undefined)
      e.previousSchool = dto.previousSchool?.trim() || null;
    if (dto.source !== undefined) e.source = dto.source;
    if (dto.notes !== undefined) e.notes = dto.notes?.trim() || null;
    if (dto.followUpOn !== undefined) e.followUpOn = dto.followUpOn ?? null;
    if (dto.lostReason !== undefined)
      e.lostReason = dto.lostReason?.trim() || null;
    if (dto.admittedStudentId !== undefined)
      e.admittedStudentId = dto.admittedStudentId ?? null;
    if (dto.stage !== undefined) e.stage = dto.stage;
    if (e.admittedStudentId && dto.stage === undefined) e.stage = 'admitted';
    if (e.stage === 'admitted' || e.stage === 'lost') e.followUpOn = null;
    return this.enquiries.save(e);
  }
}
