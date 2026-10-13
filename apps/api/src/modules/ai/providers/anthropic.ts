/**
 * Claude driver — the upgrade path from Groq.
 *
 * Switch to it by setting AI_PROVIDER=anthropic and ANTHROPIC_API_KEY; nothing
 * in the agent core or the tool layer changes.
 *
 * Two things this gives that Groq does not:
 *  - Prompt caching on the stable prefix (system prompt + tool definitions),
 *    which is where most of the cost of a multi-turn agent sits.
 *  - Adaptive thinking, which materially helps multi-step diagnosis.
 */
import Anthropic from '@anthropic-ai/sdk';
import {
  AgentMessage,
  AgentToolCall,
  ChatRequest,
  ChatResult,
  FinishReason,
  LlmProvider,
  ProviderNotConfiguredError,
  ProviderUsage,
} from './types';
import { env } from '../../../config/env';
import { logger } from '../../../utils/logger';

/** USD per 1M tokens. Cache reads are billed far below fresh input. */
const PRICE_PER_MTOK: Record<
  string,
  { input: number; output: number; cacheRead: number }
> = {
  'claude-opus-5-5': { input: 4.0, output: 20.0, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2.0, output: 10.0, cacheRead: 0.2 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

const FALLBACK_PRICE = { input: 4.0, output: 20.0, cacheRead: 0.2 };

function mapStopReason(raw: string | null): FinishReason {
  switch (raw) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'tool_use':
      return 'tool_calls';
    case 'max_tokens':
      return 'length';
    case 'refusal':
      return 'refusal';
    default:
      return 'other';
  }
}

/**
 * Claude keeps system text out of `messages`, so the system turns are hoisted
 * into the `system` field and the rest are mapped to content blocks.
 */
function splitMessages(messages: AgentMessage[]): {
  system: string;
  turns: Anthropic.MessageParam[];
} {
  const systemParts: string[] = [];
  const turns: Anthropic.MessageParam[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      if (m.content) systemParts.push(m.content);
      continue;
    }

    if (m.role === 'tool') {
      turns.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: m.toolCallId ?? '',
            content: m.content ?? '',
          },
        ],
      });
      continue;
    }

    if (m.role === 'assistant') {
      // Replay provider blocks verbatim when we have them: Claude binds
      // reasoning blocks to the conversation that produced them, so the
      // history must go back unchanged rather than be rebuilt from text.
      if (Array.isArray(m.providerBlocks) && m.providerBlocks.length) {
        turns.push({
          role: 'assistant',
          content: m.providerBlocks as Anthropic.ContentBlockParam[],
        });
        continue;
      }

      const blocks: Anthropic.ContentBlockParam[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const tc of m.toolCalls ?? []) {
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.input,
        });
      }
      if (blocks.length) turns.push({ role: 'assistant', content: blocks });
      continue;
    }

    turns.push({ role: 'user', content: m.content ?? '' });
  }

  return { system: systemParts.join('\n\n'), turns };
}

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  readonly agentModel: string;
  readonly fastModel: string;
  private readonly client: Anthropic;

  constructor() {
    if (!env.ANTHROPIC_API_KEY) {
      throw new ProviderNotConfiguredError('Claude', 'ANTHROPIC_API_KEY');
    }
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    this.agentModel = env.ANTHROPIC_AGENT_MODEL;
    this.fastModel = env.ANTHROPIC_FAST_MODEL;
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const model = req.fast ? this.fastModel : this.agentModel;
    const startedAt = Date.now();
    const { system, turns } = splitMessages(req.messages);

    const tools: Anthropic.ToolUnion[] | undefined = req.tools?.length
      ? req.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters as Anthropic.Tool.InputSchema,
        }))
      : undefined;

    // Cache the stable prefix — system prompt and tool definitions are
    // identical across every turn of every conversation for a given role.
    const systemField: Anthropic.MessageCreateParams['system'] = system
      ? [
          {
            type: 'text',
            text: system,
            ...(req.cacheableSystemPrefix
              ? { cache_control: { type: 'ephemeral' as const } }
              : {}),
          },
        ]
      : undefined;

    const response = await this.client.messages.create({
      model,
      max_tokens: req.maxTokens ?? 8192,
      ...(systemField ? { system: systemField } : {}),
      messages: turns,
      ...(tools ? { tools } : {}),
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
    });

    if (response.stop_reason === 'refusal') {
      logger.warn('Claude declined the agent request', {
        category: response.stop_details?.category,
      });
    }

    let text: string | null = null;
    const toolCalls: AgentToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        text = (text ?? '') + block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: (block.input ?? {}) as Record<string, unknown>,
        });
      }
    }

    const usage: ProviderUsage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cachedInputTokens: response.usage.cache_read_input_tokens ?? 0,
      totalTokens:
        response.usage.input_tokens +
        response.usage.output_tokens +
        (response.usage.cache_read_input_tokens ?? 0),
    };

    return {
      text,
      toolCalls,
      usage,
      model: response.model,
      finishReason: mapStopReason(response.stop_reason),
      latencyMs: Date.now() - startedAt,
    };
  }

  costUsd(model: string, usage: ProviderUsage): number {
    const price = PRICE_PER_MTOK[model] ?? FALLBACK_PRICE;
    return (
      (usage.inputTokens / 1_000_000) * price.input +
      (usage.cachedInputTokens / 1_000_000) * price.cacheRead +
      (usage.outputTokens / 1_000_000) * price.output
    );
  }
}
