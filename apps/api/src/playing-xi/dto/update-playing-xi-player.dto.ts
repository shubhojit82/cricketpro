import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePlayingXiPlayerDto {
  @IsOptional()
  @IsBoolean()
  isCaptain?: boolean;

  @IsOptional()
  @IsBoolean()
  isWicketKeeper?: boolean;
}
