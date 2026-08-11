import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateVenueDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  name!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @Length(1, 100)
  city?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @Length(1, 100)
  country?: string;
}
