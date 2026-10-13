/**
 * Provider factory. AI_PROVIDER in .env decides which driver the agent uses;
 * the instance is built once and reused.
 */
import { LlmProvider } from './types';
import { GroqProvider } from './groq';
import { AnthropicProvider } from './anthropic';
import { env } from '../../../config/env';
import { logger } from '../../../utils/logger';

let cached: LlmProvider | null = null;

export function getProvider(): LlmProvider {
  if (cached) return cached;

  cached =
    env.AI_PROVIDER === 'anthropic'
      ? new AnthropicProvider()
      : new GroqProvider();

  logger.info('AI provider initialised', {
    provider: cached.name,
    agentModel: cached.agentModel,
    fastModel: cached.fastModel,
  });

  return cached;
}

/** True when the configured provider has credentials — used by health checks. */
export function isProviderConfigured(): boolean {
  return env.AI_PROVIDER === 'anthropic'
    ? Boolean(env.ANTHROPIC_API_KEY)
    : Boolean(env.GROQ_API_KEY);
}

export * from './types';
