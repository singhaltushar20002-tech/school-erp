import {
  IsBoolean,
  IsDefined,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

const MAX = 100_000_000;

/** Monthly amounts in minor units. */
export class SalaryStructureDto {
  @IsDefined()
  @IsInt()
  @Min(0)
  @Max(MAX)
  basic: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX)
  hra?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX)
  da?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX)
  otherAllowances?: number;

  @IsOptional()
  @IsBoolean()
  pfApplicable?: boolean;

  @IsOptional()
  @IsBoolean()
  esiApplicable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX)
  tdsMonthly?: number;
}

export class CreateRunDto {
  @IsDefined()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period must be YYYY-MM' })
  period: string;
}
