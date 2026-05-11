export const STRIPE_PAYMENT_FRAUD_QUEUE = 'stripe-payment-fraud' as const;

export const STRIPE_CHECKOUT_JOB_NAME = 'process-checkout' as const;

/** Easy local test: 3rd+ completed checkout for same user within this window is auto-flagged. */
export const FRAUD_VELOCITY_WINDOW_MS = 3 * 60 * 1000;
export const FRAUD_VELOCITY_PAYMENT_THRESHOLD = 3;
