import {
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBookDto {
  @IsDefined()
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  author?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  publisher?: string | null;

  /** How many copies to add (accession numbers are given in order). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  copies?: number;
}

export class AddCopiesDto {
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(200)
  count: number;
}

export class FilterBooksDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class IssueDto {
  @IsDefined()
  @IsString()
  @MaxLength(24)
  accessionNo: string;

  /** The student's ID (admission number). */
  @IsDefined()
  @IsString()
  @MaxLength(40)
  studentId: string;

  /** Days until it's due (default 14). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;
}

export class FilterIssuesDto {
  @IsOptional()
  @IsIn(['out', 'overdue', 'returned'])
  status?: 'out' | 'overdue' | 'returned';
}
