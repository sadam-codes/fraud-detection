import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FraudPrompt } from './entities/fraud-prompt.entity';
import { StripePayment } from './entities/stripe-payment.entity';
import { FraudPromptService } from './fraud-prompt.service';
import { GroqFraudService } from './groq-fraud.service';
import { STRIPE_PAYMENT_FRAUD_QUEUE } from './payments.constants';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripePaymentProcessor } from './stripe-payment.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([StripePayment, FraudPrompt]),
    AuthModule,
    BullModule.registerQueue({ name: STRIPE_PAYMENT_FRAUD_QUEUE }),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    FraudPromptService,
    GroqFraudService,
    StripePaymentProcessor,
    RolesGuard,
  ],
})
export class PaymentsModule {}
