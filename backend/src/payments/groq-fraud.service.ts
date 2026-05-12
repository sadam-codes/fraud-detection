import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FraudPromptService } from './fraud-prompt.service';

export type GroqFraudVerdict = {
  fraudulent: boolean;
  reason: string | null;
};

@Injectable()
export class GroqFraudService {
  private readonly logger = new Logger(GroqFraudService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly fraudPrompt: FraudPromptService,
  ) {}

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

    const systemPrompt = await this.fraudPrompt.getEffectiveSystemPrompt();

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
            { role: 'system', content: systemPrompt },
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
          ? parsed.reason.slice(0, 500)
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
