import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DEFAULT_FRAUD_SYSTEM_PROMPT } from './fraud-prompt-defaults';
import { FraudPrompt } from './entities/fraud-prompt.entity';

const SINGLETON_ID = 'default';
const MIN_STORED_LENGTH = 200;

@Injectable()
export class FraudPromptService {
  constructor(
    @InjectRepository(FraudPrompt)
    private readonly repo: Repository<FraudPrompt>,
  ) {}

  /** Used by Groq worker: DB prompt if valid length, else built-in default. */
  async getEffectiveSystemPrompt(): Promise<string> {
    const row = await this.repo.findOne({ where: { id: SINGLETON_ID } });
    const t = row?.systemPrompt?.trim();
    if (t && t.length >= MIN_STORED_LENGTH) {
      return t;
    }
    return DEFAULT_FRAUD_SYSTEM_PROMPT;
  }

  /** Admin editor: show DB text or built-in default if unset. */
  async getAdminView(): Promise<{
    systemPrompt: string;
    updatedAt: string | null;
    source: 'database' | 'built_in';
  }> {
    const row = await this.repo.findOne({ where: { id: SINGLETON_ID } });
    const t = row?.systemPrompt?.trim();
    if (row && t && t.length >= MIN_STORED_LENGTH) {
      return {
        systemPrompt: t,
        updatedAt: row.updatedAt.toISOString(),
        source: 'database',
      };
    }
    return {
      systemPrompt: DEFAULT_FRAUD_SYSTEM_PROMPT,
      updatedAt: null,
      source: 'built_in',
    };
  }

  async saveAdminPrompt(systemPrompt: string): Promise<{
    ok: true;
    updatedAt: string;
  }> {
    const trimmed = systemPrompt.trim();
    let row = await this.repo.findOne({ where: { id: SINGLETON_ID } });
    if (!row) {
      row = this.repo.create({ id: SINGLETON_ID, systemPrompt: trimmed });
    } else {
      row.systemPrompt = trimmed;
    }
    const saved = await this.repo.save(row);
    return { ok: true, updatedAt: saved.updatedAt.toISOString() };
  }

  /** Remove custom prompt so Groq uses the built-in default again. */
  async clearStoredPrompt(): Promise<{ ok: true }> {
    await this.repo.delete({ id: SINGLETON_ID });
    return { ok: true };
  }
}