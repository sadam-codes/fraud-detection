import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type GroqFraudVerdict = {
  fraudulent: boolean;
  reason: string | null;
};

const SYSTEM = `You are a payment fraud analyst for Stripe checkouts.
Review the transaction summary and apply these rules:
- If the summary includes a line like velocity_prior_completed_checkouts_same_user_last_3min=N where N is 2 or greater, treat this as the 3rd (or more) payment within ~3 minutes for that user — you MUST set fraudulent=true with a short velocity reason (this is an intentional easy-test rule).
- Flag if amounts, currency, or line items look inconsistent or impossible (e.g. zero or negative totals where payment should have occurred).
- Flag if customer identity signals are incoherent (obviously fake or disposable patterns combined with high value) when the data supports that conclusion.
- Flag if subscription vs one-time signals contradict the described mode.
- Do NOT flag solely because the payment is a test or small amount; tests are allowed.
- Prefer clearing legitimate-looking payments; only flag when evidence in the text supports suspicion.

Respond with a single JSON object only, no markdown, shape:
{"fraudulent": boolean, "reason": string | null}
If fraudulent is false, reason must be null. If true, reason must be a short factual explanation (max 400 chars).`;

@Injectable()
export class GroqFraudService {
  private readonly logger = new Logger(GroqFraudService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Local / staging testing: set env `FRAUD_MOCK_VERDICT=flagged` or `cleared`
   * to skip Groq and force a verdict (queue → DB → frontend). Ignored when
   * `NODE_ENV=production`. Remove the variable for real model behaviour.
   */
  async analyzeTransactionSummary(summary: string): Promise<GroqFraudVerdict> {
    const mock = this.config.get<string>('FRAUD_MOCK_VERDICT')?.trim().toLowerCase();
    if (mock === 'flagged' || mock === 'cleared') {
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn(
          'FRAUD_MOCK_VERDICT is set but ignored in production; using Groq.',
        );
      } else if (mock === 'flagged') {
        this.logger.warn(
          'FRAUD_MOCK_VERDICT=flagged — Groq skipped (pipeline/UI test only).',
        );
        return {
          fraudulent: true,
          reason:
            '[Mock] Forced fraud for testing. Unset FRAUD_MOCK_VERDICT for real Groq analysis.',
        };
      } else {
        this.logger.warn(
          'FRAUD_MOCK_VERDICT=cleared — Groq skipped (pipeline/UI test only).',
        );
        return { fraudulent: false, reason: null };
      }
    }

    const apiKey = this.config.getOrThrow<string>('GROQ_API_KEY');
    const model =
      this.config.get<string>('GROQ_MODEL')?.trim() ||
      'llama-3.3-70b-versatile';

    const timeoutMs =
      Number(this.config.get<string>('GROQ_REQUEST_TIMEOUT_MS')?.trim()) || 25_000;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: ac.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM },
            {
              role: 'user',
              content: `Transaction summary for fraud review:\n\n${summary}`,
            },
          ],
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      this.logger.warn(`Groq HTTP ${res.status}: ${errText.slice(0, 500)}`);
      throw new Error(`Groq request failed: ${res.status}`);
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = body.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      throw new Error('Groq returned empty content');
    }

    const parsed = this.parseVerdictJson(raw);
    return {
      fraudulent: Boolean(parsed.fraudulent),
      reason:
        parsed.fraudulent && typeof parsed.reason === 'string'
          ? parsed.reason.slice(0, 2000)
          : null,
    };
  }

  private parseVerdictJson(raw: string): {
    fraudulent?: boolean;
    reason?: string | null;
  } {
    const trimmed = raw.trim();
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = fence ? fence[1].trim() : trimmed;
    try {
      return JSON.parse(jsonStr) as {
        fraudulent?: boolean;
        reason?: string | null;
      };
    } catch {
      this.logger.warn(`Groq JSON parse failed, raw snippet: ${raw.slice(0, 200)}`);
      throw new Error('Invalid JSON from Groq fraud model');
    }
  }
}
