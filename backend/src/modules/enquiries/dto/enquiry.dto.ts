import { PartialType } from '@nestjs/swagger';
import {
  IsDefined,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';
import {
  ENQUIRY_SOURCES,
  ENQUIRY_STAGES,
  type EnquirySource,
  type EnquiryStage,
} from '../entities/enquiry.entity';

export class CreateEnquiryDto {
  @IsDefined()
  @IsString()
  @MaxLength(160)
  studentName: string;

  @IsOptional()
  @IsDateOnly()
  dateOfBirth?: string | null;

  @IsOptional()
  @IsIn(['male', 'female', 'other'])
  gender?: string | null;

  @IsOptional()
  @IsUUID('4')
  classId?: string | null;

  @IsDefined()
  @IsString()
  @MaxLength(160)
  guardianName: string;

  @IsDefined()
  @Matches(/^[+\d][\d\s-]{6,18}$/, { message: 'phone must be a phone number' })
  phone: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  previousSchool?: string | null;

  @IsDefined()
  @IsIn(ENQUIRY_SOURCES)
  source: EnquirySource;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @IsOptional()
  @IsDateOnly()
  followUpOn?: string | null;
}

export class UpdateEnquiryDto extends PartialType(CreateEnquiryDto) {
  @IsOptional()
  @IsIn(ENQUIRY_STAGES)
  stage?: EnquiryStage;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  lostReason?: string | null;

  /** Set with stage `admitted`: the student the enquiry became. */
  @IsOptional()
  @IsUUID('4')
  admittedStudentId?: string | null;
}

export class FilterEnquiryDto {
  @IsOptional()
  @IsIn(ENQUIRY_STAGES)
  stage?: EnquiryStage;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}
