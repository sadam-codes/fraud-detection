import { IsIn } from 'class-validator';

export class UpdatePaymentFraudReviewDto {
  @IsIn(['flagged', 'cleared'])
  status: 'flagged' | 'cleared';
}
