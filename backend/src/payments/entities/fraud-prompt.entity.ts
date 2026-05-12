import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('fraud_prompts')
export class FraudPrompt {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  @Column({ type: 'text', name: 'system_prompt' })
  systemPrompt: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
