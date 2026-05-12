import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import Stripe from 'stripe';
import { Repository } from 'typeorm';
import { StripePayment } from './entities/stripe-payment.entity';
import {
  STRIPE_CHECKOUT_JOB_NAME,
  STRIPE_PAYMENT_FRAUD_QUEUE,
} from './payments.constants';

type StripeClient = InstanceType<typeof Stripe>;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: StripeClient;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(StripePayment)
    private readonly paymentRepo: Repository<StripePayment>,
    @InjectQueue(STRIPE_PAYMENT_FRAUD_QUEUE)
    private readonly checkoutFraudQueue: Queue,
  ) {
    const secret = this.config.getOrThrow<string>('STRIPE_API_KEY');
    this.stripe = new Stripe(secret, {
      apiVersion: '2026-04-22.dahlia',
    });
  }

  resolvePriceId(dtoPriceId?: string): string {
    const fromEnv = this.config.get<string>('STRIPE_PRICE_ID')?.trim();
    const id = dtoPriceId ?? fromEnv;
    if (!id) {
      throw new BadRequestException(
        'Provide priceId in the request body or set STRIPE_PRICE_ID in the environment (Dashboard → Product → Price ID).',
      );
    }
    return id;
  }

  isDemoIntegerPriceField(value: string | undefined): boolean {
    if (!value?.trim()) return false;
    return /^-?\d+$/.test(value.trim());
  }

  checkoutUrls(): { successUrl: string; cancelUrl: string } {
    const port = this.config.get<string>('PORT') ?? '3000';
    const rawFrontend = this.config.get<string>('FRONTEND_APP_URL')?.trim()?.replace(/\/$/, '');
    const rawApp = this.config.get<string>('APP_BASE_URL')?.trim()?.replace(/\/$/, '');
    const base = rawFrontend || rawApp || 'http://localhost:5173';
    const successPath =
      this.config.get<string>('STRIPE_SUCCESS_PATH')?.trim() ?? '/payment/success';
    const cancelPath =
      this.config.get<string>('STRIPE_CANCEL_PATH')?.trim() ?? '/payment/cancel';
    const successUrl = `${base}${successPath}?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${base}${cancelPath}`;
    return { successUrl, cancelUrl };
  }

  async createCheckoutSession(
    priceId: string,
    userId: string,
    options?: { clientDemoBillingField?: string },
  ) {
    const { successUrl, cancelUrl } = this.checkoutUrls();
    const price = await this.stripe.prices.retrieve(priceId);
    const mode =
      price.type === 'recurring'
        ? ('subscription' as const)
        : ('payment' as const);

    const demo = options?.clientDemoBillingField?.trim();
    const metadata =
      demo !== undefined && demo !== ''
        ? { client_demo_price_field: demo.slice(0, 500) }
        : undefined;

    const session = await this.stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      ...(metadata ? { metadata } : {}),
    });
    if (!session.url) {
      throw new BadRequestException('Checkout session has no URL');
    }
    return { url: session.url, sessionId: session.id };
  }

  listForUser(userId: string) {
    return this.paymentRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  listAllForAdmin() {
    return this.paymentRepo.find({
      relations: { user: true },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async updateFraudReviewByAdmin(
    paymentId: string,
    status: 'flagged' | 'cleared',
  ): Promise<StripePayment> {
    const row = await this.paymentRepo.findOne({ where: { id: paymentId } });
    if (!row) {
      throw new NotFoundException('Payment not found');
    }
    if (status === 'cleared') {
      row.fraudFlagged = false;
      row.fraudReason = null;
    } else {
      row.fraudFlagged = true;
      if (!row.fraudReason?.trim()) {
        row.fraudReason = 'Manually flagged by administrator.';
      }
    }
    return this.paymentRepo.save(row);
  }

  private async enqueueCompletedCheckout(sessionId: string): Promise<void> {
    const jobId = `checkout-${sessionId}`;
    const existing = await this.checkoutFraudQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (
        state === 'waiting' ||
        state === 'active' ||
        state === 'delayed'
      ) {
        this.logger.debug(`Checkout fraud job already queued: ${jobId}`);
        return;
      }
    }

    await this.checkoutFraudQueue.add(
      STRIPE_CHECKOUT_JOB_NAME,
      { sessionId },
      {
        jobId,
        attempts: 5,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 500 },
      },
    );
    this.logger.log(`Queued fraud pipeline for checkout session=${sessionId}`);
  }

  async confirmCheckoutSessionForUser(
    sessionId: string,
    userId: string,
  ): Promise<{ ok: true; alreadyRecorded?: boolean; queued?: boolean }> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'subscription'],
    });

    const ref = session.client_reference_id?.trim();
    if (ref !== userId) {
      throw new ForbiddenException(
        'This checkout session does not belong to the signed-in user.',
      );
    }

    const status = session.payment_status;
    if (status !== 'paid' && status !== 'no_payment_required') {
      throw new BadRequestException(
        `Checkout is not complete yet (payment_status: ${status ?? 'unknown'}).`,
      );
    }

    const existing = await this.paymentRepo.findOne({
      where: { stripeCheckoutSessionId: session.id },
    });
    if (existing) {
      return { ok: true, alreadyRecorded: true };
    }

    await this.enqueueCompletedCheckout(session.id);
    return { ok: true, queued: true };
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    const webhookSecret = this.config.getOrThrow<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    let event: ReturnType<StripeClient['webhooks']['constructEvent']>;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err) {
      this.logger.warn(`Webhook signature verification failed: ${err}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as { id: string };
        await this.enqueueCompletedCheckout(session.id);
        break;
      }
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }

    return { received: true };
  }
}
