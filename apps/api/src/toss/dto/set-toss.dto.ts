import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, Length } from 'class-validator';
import { TossDecision } from '@prisma/client';

export class SetTossDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  winnerTeamId!: string;

  @IsEnum(TossDecision)
  decision!: TossDecision;
}
