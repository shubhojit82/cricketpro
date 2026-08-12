import { MatchOfficialRole } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class UpdateMatchOfficialDto {
  @IsOptional()
  @IsEnum(MatchOfficialRole)
  role?: MatchOfficialRole;

  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
