import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import Stripe from 'stripe';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { GroqFraudService } from './groq-fraud.service';
import { StripePayment } from './entities/stripe-payment.entity';
import {
  FRAUD_VELOCITY_PAYMENT_THRESHOLD,
  FRAUD_VELOCITY_WINDOW_MS,
  STRIPE_CHECKOUT_JOB_NAME,
  STRIPE_PAYMENT_FRAUD_QUEUE,
} from './payments.constants';
import { buildCheckoutFraudContextSummary } from './stripe-checkout-fraud-context';

type StripeClient = InstanceType<typeof Stripe>;
type StripeCheckoutSession = Awaited<
  ReturnType<StripeClient['checkout']['sessions']['retrieve']>
>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export type StripeCheckoutJobPayload = {
  sessionId: string;
};

/** Prefer charge time (actual capture), then PI creation, then session creation. */
function resolveCheckoutPaidAt(session: StripeCheckoutSession): Date {
  const pi = session.payment_intent;
  if (pi && typeof pi === 'object') {
    const lc = pi.latest_charge;
    if (
      lc &&
      typeof lc === 'object' &&
      typeof (lc as { created?: unknown }).created === 'number'
    ) {
      return new Date((lc as { created: number }).created * 1000);
    }
    if (typeof pi.created === 'number') {
      return new Date(pi.created * 1000);
    }
  }
  if (typeof session.created === 'number') {
    return new Date(session.created * 1000);
  }
  return new Date();
}

@Processor(STRIPE_PAYMENT_FRAUD_QUEUE)
export class StripePaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(StripePaymentProcessor.name);
  private readonly stripe: StripeClient;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(StripePayment)
    private readonly paymentRepo: Repository<StripePayment>,
    private readonly groqFraud: GroqFraudService,
  ) {
    super();
    const secret = this.config.getOrThrow<string>('STRIPE_API_KEY');
    this.stripe = new Stripe(secret, {
      apiVersion: '2026-04-22.dahlia',
    });
  }

  async process(job: Job<StripeCheckoutJobPayload>): Promise<void> {
    if (job.name !== STRIPE_CHECKOUT_JOB_NAME) {
      this.logger.warn(`Ignoring unknown job name: ${job.name}`);
      return;
    }

    const sessionId = job.data.sessionId;
    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: [
        'payment_intent.latest_charge',
        'subscription',
        'line_items.data.price.product',
        'invoice.lines.data.price',
      ],
    });

    const status = session.payment_status;
    if (status !== 'paid' && status !== 'no_payment_required') {
      this.logger.warn(
        `Skip session ${sessionId}: payment_status=${status ?? 'unknown'}`,
      );
      return;
    }

    const existing = await this.paymentRepo.findOne({
      where: { stripeCheckoutSessionId: session.id },
    });
    if (existing) {
      this.logger.debug(`Session ${sessionId} already persisted`);
      return;
    }

    const summary = await buildCheckoutFraudContextSummary(
      this.stripe,
      session,
    );

    const ref = session.client_reference_id?.trim();
    const userId = ref && isUuid(ref) ? ref : null;
    const email =
      session.customer_details?.email?.trim().toLowerCase() ??
      session.customer_email?.trim().toLowerCase() ??
      null;

    const priorInWindow = await this.countCompletedPaymentsInVelocityWindow(
      userId,
      email,
    );
    const summaryWithVelocity = `${summary}\nvelocity_prior_completed_checkouts_same_user_last_3min=${priorInWindow}\nvelocity_window_minutes=3\nvelocity_threshold_payments=${FRAUD_VELOCITY_PAYMENT_THRESHOLD}\n`;

    let groqVerdict: { fraudulent: boolean; reason: string | null };
    try {
      groqVerdict =
        await this.groqFraud.analyzeTransactionSummary(summaryWithVelocity);
    } catch (err) {
      this.logger.error(
        `Groq fraud analysis failed for session=${session.id}; saving payment as cleared. ${err}`,
      );
      groqVerdict = { fraudulent: false, reason: null };
    }

    if (priorInWindow >= FRAUD_VELOCITY_PAYMENT_THRESHOLD - 1) {
      this.logger.debug(
        `Velocity context for model: priorInWindow=${priorInWindow} session=${session.id}`,
      );
    }

    await this.savePaymentFromStripeSession(session, groqVerdict);
  }

  private async countCompletedPaymentsInVelocityWindow(
    userId: string | null,
    email: string | null,
  ): Promise<number> {
    const since = new Date(Date.now() - FRAUD_VELOCITY_WINDOW_MS);
    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .where('COALESCE(p.checkoutPaidAt, p.createdAt) > :since', { since });
    if (userId) {
      qb.andWhere('p.userId = :userId', { userId });
    } else if (email) {
      qb.andWhere('LOWER(TRIM(p.customerEmail)) = :email', {
        email: email.toLowerCase(),
      });
    } else {
      return 0;
    }
    return qb.getCount();
  }

  private async savePaymentFromStripeSession(
    session: StripeCheckoutSession,
    verdict: { fraudulent: boolean; reason: string | null },
  ): Promise<void> {
    const pi = session.payment_intent;
    const stripePaymentIntentId =
      typeof pi === 'string' ? pi : (pi?.id ?? null);
    const sub = session.subscription;
    const stripeSubscriptionId =
      typeof sub === 'string' ? sub : (sub?.id ?? null);
    const cust = session.customer;
    const stripeCustomerId =
      typeof cust === 'string' ? cust : (cust?.id ?? null);

    const ref = session.client_reference_id?.trim();
    const user: User | null =
      ref && isUuid(ref) ? ({ id: ref } as User) : null;

    const emailRaw =
      session.customer_details?.email ?? session.customer_email ?? null;
    const email = emailRaw?.trim() ? emailRaw.trim().toLowerCase() : null;
    const checkoutPaidAt = resolveCheckoutPaidAt(session);

    const row = this.paymentRepo.create({
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId,
      stripeSubscriptionId,
      stripeCustomerId,
      checkoutMode: session.mode,
      amountTotal: session.amount_total,
      currency: session.currency ?? null,
      paymentStatus: session.payment_status ?? 'unknown',
      customerEmail: email,
      user,
      checkoutPaidAt,
      fraudFlagged: verdict.fraudulent,
      fraudReason: verdict.fraudulent ? verdict.reason : null,
    });

    try {
      await this.paymentRepo.save(row);
      this.logger.log(
        `Saved Stripe payment session=${session.id} fraudFlagged=${verdict.fraudulent}`,
      );
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as { driverError?: { code?: string } }).driverError?.code ===
          '23505'
      ) {
        this.logger.debug(
          `Duplicate stripe_payments row for session=${session.id}`,
        );
        return;
      }
      throw err;
    }
  }
}
