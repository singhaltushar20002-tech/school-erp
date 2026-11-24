import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';

export class FilterGuardianDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  /** Any format; matched normalized. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUUID('4')
  userId?: string;

  /** Part of the name, or of the phone number (3+ digits). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  /** Only guardians with (`yes`) or without (`no`) a portal sign-in. */
  @IsOptional()
  @IsIn(['yes', 'no'])
  portal?: 'yes' | 'no';

  /** Adds `children` (linked students) to each row. */
  @IsOptional()
  @IsIn(['true', 'false'])
  withChildren?: 'true' | 'false';
}
