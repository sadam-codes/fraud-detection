import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  RawBody,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../auth/entities/user.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthUserPayload,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ConfirmCheckoutSessionDto } from './dto/confirm-checkout-session.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout-session')
  @UseGuards(JwtAuthGuard)
  createCheckoutSession(
    @Body() dto: CreateCheckoutSessionDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const raw = dto.priceId?.trim();
    const stripePriceId = this.paymentsService.isDemoIntegerPriceField(raw)
      ? this.paymentsService.resolvePriceId(undefined)
      : this.paymentsService.resolvePriceId(raw);
    const clientDemoBillingField = this.paymentsService.isDemoIntegerPriceField(raw)
      ? raw
      : undefined;
    return this.paymentsService.createCheckoutSession(stripePriceId, user.id, {
      clientDemoBillingField,
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  listMyPayments(@CurrentUser() user: AuthUserPayload) {
    return this.paymentsService.listForUser(user.id);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  listAllPaymentsForAdmin() {
    return this.paymentsService.listAllForAdmin();
  }

  @Post('confirm-session')
  @UseGuards(JwtAuthGuard)
  confirmCheckoutSession(
    @Body() dto: ConfirmCheckoutSessionDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.paymentsService.confirmCheckoutSessionForUser(
      dto.sessionId,
      user.id,
    );
  }

  @Post('webhook')
  @HttpCode(200)
  stripeWebhook(
    @Headers('stripe-signature') signature: string | undefined,
    @RawBody() rawBody: Buffer | undefined,
  ) {
    if (!rawBody?.length) {
      throw new BadRequestException('Missing raw body for webhook');
    }
    return this.paymentsService.handleWebhook(rawBody, signature);
  }

  @Get('success')
  success() {
    return {
      ok: true,
      status: 'success',
      message: 'Payment completed. This URL is for local testing after Checkout.',
    };
  }

  @Get('cancel')
  cancel() {
    return {
      ok: true,
      status: 'canceled',
      message: 'Checkout was canceled before payment.',
    };
  }
}
