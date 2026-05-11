import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

/** Stripe Price ID, or a signed integer string (e.g. -50) for client demos — checkout still uses a real server price. */
const PRICE_ID_OR_DEMO_INT = /^(price_[a-zA-Z0-9]+|-?\d+)$/;

export class CreateCheckoutSessionDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @Matches(PRICE_ID_OR_DEMO_INT, {
    message:
      'Use a Stripe Price ID (price_…) or a whole number such as -100 for demos. Leave empty for the server default.',
  })
  priceId?: string;
}
