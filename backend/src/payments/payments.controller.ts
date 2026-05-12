import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { UpdateFraudSystemPromptDto } from './dto/update-fraud-system-prompt.dto';
import { UpdatePaymentFraudReviewDto } from './dto/update-payment-fraud-review.dto';
import { FraudPromptService } from './fraud-prompt.service';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly fraudPromptService: FraudPromptService,
  ) {}

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

  @Get('admin/fraud-prompt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getFraudSystemPrompt() {
    return this.fraudPromptService.getAdminView();
  }

  @Put('admin/fraud-prompt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateFraudSystemPrompt(@Body() dto: UpdateFraudSystemPromptDto) {
    return this.fraudPromptService.saveAdminPrompt(dto.systemPrompt);
  }

  @Delete('admin/fraud-prompt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  clearFraudSystemPrompt() {
    return this.fraudPromptService.clearStoredPrompt();
  }

  @Patch('admin/:paymentId/fraud-review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updatePaymentFraudReview(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: UpdatePaymentFraudReviewDto,
  ) {
    return this.paymentsService.updateFraudReviewByAdmin(paymentId, dto.status);
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
