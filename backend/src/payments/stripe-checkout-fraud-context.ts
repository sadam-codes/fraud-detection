import Stripe from 'stripe';

type StripeClient = InstanceType<typeof Stripe>;
type CheckoutSession = Awaited<
  ReturnType<StripeClient['checkout']['sessions']['retrieve']>
>;

/** Narrow shape we read from Stripe invoices (expanded on session or from retrieve). */
type InvoiceLineSummary = {
  id: string;
  status?: string | null;
  lines?: {
    data?: Array<{
      description?: string | null;
      amount: number;
      currency: string;
    }>;
  };
};

function appendInvoiceLines(parts: string[], invoice: InvoiceLineSummary): void {
  parts.push(`invoice_id=${invoice.id} status=${invoice.status ?? 'null'}`);
  for (const line of invoice.lines?.data ?? []) {
    parts.push(
      `invoice_line: ${line.description ?? 'item'} amount=${line.amount} currency=${line.currency}`,
    );
  }
}

/**
 * Builds a plain-text bundle of Stripe checkout + invoice fields for the fraud model.
 */
export async function buildCheckoutFraudContextSummary(
  stripe: StripeClient,
  session: CheckoutSession,
): Promise<string> {
  const parts: string[] = [];
  parts.push(`session_id=${session.id}`);
  parts.push(`mode=${session.mode}`);
  parts.push(`payment_status=${session.payment_status}`);
  parts.push(
    `amount_total=${session.amount_total ?? 'null'} currency=${session.currency ?? 'null'}`,
  );
  parts.push(
    `customer_email=${session.customer_details?.email ?? session.customer_email ?? 'null'}`,
  );
  parts.push(`client_reference_id=${session.client_reference_id ?? 'null'}`);

  const meta = session.metadata;
  if (meta && typeof meta === 'object' && Object.keys(meta).length > 0) {
    parts.push(`session_metadata=${JSON.stringify(meta)}`);
  }

  const li = session.line_items?.data;
  if (li?.length) {
    for (const item of li) {
      const product = item.price?.product;
      const isDeletedProduct =
        typeof product === 'object' &&
        product &&
        'deleted' in product &&
        (product as { deleted?: boolean }).deleted === true;
      const fromProduct =
        typeof product === 'object' &&
        product &&
        !isDeletedProduct &&
        'name' in product &&
        typeof (product as { name?: unknown }).name === 'string'
          ? (product as { name: string }).name
          : null;
      const desc =
        item.description ?? fromProduct ?? item.price?.id ?? 'line_item';
      parts.push(
        `line_item: ${desc} qty=${item.quantity} amount_total=${item.amount_total} currency=${item.currency}`,
      );
    }
  }

  const pi = session.payment_intent;
  if (typeof pi === 'object' && pi) {
    parts.push(`payment_intent_id=${pi.id} status=${pi.status}`);
  } else if (typeof pi === 'string') {
    parts.push(`payment_intent_id=${pi}`);
  }

  const sub = session.subscription;
  if (typeof sub === 'object' && sub) {
    parts.push(`subscription_id=${sub.id} status=${sub.status}`);
  } else if (typeof sub === 'string') {
    parts.push(`subscription_id=${sub}`);
  }

  const inv = session.invoice;
  if (typeof inv === 'object' && inv) {
    appendInvoiceLines(parts, inv as InvoiceLineSummary);
  } else if (typeof inv === 'string') {
    const retrieved = await stripe.invoices.retrieve(inv, {
      expand: ['lines.data.price'],
    });
    appendInvoiceLines(parts, retrieved as InvoiceLineSummary);
  }

  return parts.join('\n');
}
