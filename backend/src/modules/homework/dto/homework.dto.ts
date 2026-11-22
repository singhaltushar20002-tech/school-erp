import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';

export class CreateHomeworkDto {
  @IsDefined()
  @IsUUID('4')
  sectionId: string;

  @IsDefined()
  @IsUUID('4')
  classSubjectId: string;

  @IsDefined()
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsDefined()
  @IsDateOnly()
  dueDate: string;

  /** From `POST /homework/attachments`. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('4', { each: true })
  attachmentFileIds?: string[];
}

export class FilterHomeworkDto {
  @IsOptional()
  @IsUUID('4')
  sectionId?: string;

  /** Due on or after (default: 14 days ago). */
  @IsOptional()
  @IsDateOnly()
  from?: string;
}

/** Everyone who handed it in; the rest have not. */
export class SetSubmissionsDto {
  @IsDefined()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  enrollmentIds: string[];
}
