import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Length,
} from 'class-validator';

export class CreateTournamentDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  code!: string;
}
