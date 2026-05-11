import { IsString, Matches } from 'class-validator';

export class ConfirmCheckoutSessionDto {
  @IsString()
  @Matches(/^cs_[a-zA-Z0-9_]+$/)
  sessionId!: string;
}
