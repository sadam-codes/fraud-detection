import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StripePayment } from './entities/stripe-payment.entity';
import { GroqFraudService } from './groq-fraud.service';
import { STRIPE_PAYMENT_FRAUD_QUEUE } from './payments.constants';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripePaymentProcessor } from './stripe-payment.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([StripePayment]),
    AuthModule,
    BullModule.registerQueue({ name: STRIPE_PAYMENT_FRAUD_QUEUE }),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, GroqFraudService, StripePaymentProcessor, RolesGuard],
})
export class PaymentsModule {}
