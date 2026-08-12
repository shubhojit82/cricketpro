import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class AppendMatchEventDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  inningsNumber?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  overNumber?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  ballNumber?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sequenceNumber?: number | null;

  @IsOptional()
  @ValidateIf((o) => o.payload !== undefined)
  payload?: any;

  @IsOptional()
  @IsString()
  createdBy?: string | null;

  @IsOptional()
  @IsString()
  deviceId?: string | null;

  @IsString()
  @IsNotEmpty()
  clientEventId!: string;

  @IsOptional()
  @IsUUID()
  supersedesEventId?: string | null;

  @IsOptional()
  @IsString()
  correlationId?: string | null;
}
