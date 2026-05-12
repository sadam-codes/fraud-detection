import { User } from '../../auth/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('stripe_payments')
export class StripePayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  stripeCheckoutSessionId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripePaymentIntentId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripeSubscriptionId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripeCustomerId: string | null;

  @Column({ type: 'varchar', length: 32 })
  checkoutMode: string;

  @Column({ type: 'int', nullable: true })
  amountTotal: number | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  currency: string | null;

  @Column({ type: 'varchar', length: 64 })
  paymentStatus: string;

  @Column({ type: 'varchar', length: 320, nullable: true })
  customerEmail: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  /** Set by the fraud worker after Groq analysis; true when fraud is suspected. */
  @Column({ type: 'boolean', default: false })
  fraudFlagged: boolean;

  /** Human-readable fraud rationale when fraudFlagged is true; otherwise null. */
  @Column({ type: 'text', nullable: true })
  fraudReason: string | null;

  /**
   * Stripe-side payment timing (charge / payment_intent / session), used for velocity.
   * Row `createdAt` reflects when the worker persisted the record and can cluster falsely.
   */
  @Column({ type: 'timestamptz', nullable: true })
  checkoutPaidAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
