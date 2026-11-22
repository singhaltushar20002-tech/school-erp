import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class StopDto {
  @IsDefined()
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @Matches(TIME, { message: 'pickupTime must be HH:mm' })
  pickupTime?: string | null;

  @IsOptional()
  @Matches(TIME, { message: 'dropTime must be HH:mm' })
  dropTime?: string | null;
}

export class CreateRouteDto {
  @IsDefined()
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  vehicleNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  driverName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  driverPhone?: string | null;

  /** Minor units. */
  @IsDefined()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  monthlyFee: number;

  /** In order; replaces the route's stops (students stay on stops kept by name). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => StopDto)
  stops?: StopDto[];
}

export class UpdateRouteDto extends PartialType(CreateRouteDto) {}

export class AssignStopDto {
  @IsDefined()
  @IsUUID('4')
  studentId: string;

  @IsDefined()
  @IsUUID('4')
  stopId: string;
}

export class TransportBillingDto {
  @IsDefined()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period must be YYYY-MM' })
  period: string;
}
