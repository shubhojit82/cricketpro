import { MatchOfficialRole } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateMatchOfficialDto {
  @IsEnum(MatchOfficialRole)
  role!: MatchOfficialRole;

  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @IsString()
  @MinLength(1)
  name!: string;
}
