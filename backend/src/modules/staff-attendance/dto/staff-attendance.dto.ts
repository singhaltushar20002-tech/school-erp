import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';
import {
  STAFF_STATUSES,
  type StaffStatus,
} from '../entities/staff-attendance.entity';
import { LEAVE_TYPES, type LeaveType } from '../entities/staff-leave.entity';

export class DayQueryDto {
  /** Defaults to today. */
  @IsOptional()
  @IsDateOnly()
  date?: string;
}

export class MonthQueryDto {
  @IsDefined()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' })
  month: string;
}

export class StaffMarkDto {
  @IsDefined()
  @IsUUID('4')
  employeeId: string;

  @IsDefined()
  @IsIn(STAFF_STATUSES)
  status: StaffStatus;
}

export class MarkStaffDto {
  @IsDefined()
  @IsDateOnly()
  date: string;

  @IsDefined()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => StaffMarkDto)
  records: StaffMarkDto[];
}

export class CreateStaffLeaveDto {
  @IsDefined()
  @IsUUID('4')
  employeeId: string;

  @IsDefined()
  @IsDateOnly()
  fromDate: string;

  @IsOptional()
  @IsDateOnly()
  toDate?: string;

  @IsDefined()
  @IsIn(LEAVE_TYPES)
  leaveType: LeaveType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** Record it as already approved (the office entering approved leave). */
  @IsOptional()
  @IsBoolean()
  approved?: boolean;
}

export class LeaveDecisionDto {
  @IsDefined()
  @IsBoolean()
  approve: boolean;
}

export class FilterStaffLeaveDto {
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';
}

export class AssignSubstituteDto {
  @IsDefined()
  @IsDateOnly()
  date: string;

  @IsDefined()
  @IsUUID('4')
  timetableId: string;

  /** Null removes the substitute. */
  @IsOptional()
  @IsUUID('4')
  employeeId?: string | null;
}
