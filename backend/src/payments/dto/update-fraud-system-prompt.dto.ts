import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateFraudSystemPromptDto {
  @IsString()
  @MinLength(200, {
    message:
      'System prompt must be at least 200 characters so JSON output rules stay intact.',
  })
  @MaxLength(32000)
  systemPrompt: string;
}
