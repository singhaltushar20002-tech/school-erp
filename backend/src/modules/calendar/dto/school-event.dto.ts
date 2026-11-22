import { PartialType } from '@nestjs/swagger';
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
} from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';
import {
  SCHOOL_EVENT_KINDS,
  type SchoolEventKind,
} from '../entities/school-event.entity';

export class CreateSchoolEventDto {
  @IsDefined()
  @IsString()
  @MaxLength(160)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsDefined()
  @IsIn(SCHOOL_EVENT_KINDS)
  kind: SchoolEventKind;

  @IsDefined()
  @IsDateOnly()
  dateFrom: string;

  /** Defaults to `dateFrom`. */
  @IsOptional()
  @IsDateOnly()
  dateTo?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  classIds?: string[];

  @IsOptional()
  @IsBoolean()
  forParents?: boolean;
}

export class UpdateSchoolEventDto extends PartialType(CreateSchoolEventDto) {}

export class CalendarQueryDto {
  /** `YYYY-MM`. */
  @IsDefined()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' })
  month: string;

  /** Only what applies to this class. */
  @IsOptional()
  @IsUUID('4')
  classId?: string;
}
