/**
 * Groq driver.
 *
 * Groq serves an OpenAI-compatible chat-completions endpoint, so this talks to
 * it over plain fetch rather than pulling in another SDK. The wire shape here
 * (messages / tools / tool_calls / usage) is the OpenAI one, kept behind the
 * LlmProvider interface so the agent core stays vendor-neutral.
 */
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

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

/**
 * USD per 1M tokens. Groq changes pricing and retires models, so these are
 * overridable from .env and should be checked against the live model list
 * (GET /openai/v1/models) rather than trusted indefinitely.
 */
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  'openai/gpt-oss-120b': { input: 0.15, output: 0.75 },
  'openai/gpt-oss-20b': { input: 0.1, output: 0.5 },
};

const FALLBACK_PRICE = { input: 0.6, output: 0.8 };

interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAiChoice {
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: OpenAiToolCall[];
  };
  finish_reason: string;
}

interface OpenAiResponse {
  model: string;
  choices: OpenAiChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

function toWireMessage(m: AgentMessage): Record<string, unknown> {
  if (m.role === 'tool') {
    return {
      role: 'tool',
      tool_call_id: m.toolCallId,
      content: m.content ?? '',
    };
  }

  if (m.role === 'assistant' && m.toolCalls?.length) {
    return {
      role: 'assistant',
      content: m.content ?? '',
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.input) },
      })),
    };
  }

  return { role: m.role, content: m.content ?? '' };
}

function mapFinishReason(raw: string): FinishReason {
  switch (raw) {
    case 'stop':
      return 'stop';
    case 'tool_calls':
    case 'function_call':
      return 'tool_calls';
    case 'length':
      return 'length';
    case 'content_filter':
      return 'refusal';
    default:
      return 'other';
  }
}

/**
 * Tool arguments arrive as a JSON string the model generated, so it can be
 * malformed or truncated. Parse defensively — a bad parse becomes an empty
 * input the tool layer rejects with a validation error, not a thrown 500.
 */
function parseToolCalls(calls: OpenAiToolCall[] | undefined): AgentToolCall[] {
  if (!calls?.length) return [];

  return calls.map((c) => {
    let input: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(c.function.arguments || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        input = parsed as Record<string, unknown>;
      }
    } catch {
      logger.warn('Groq returned unparseable tool arguments', {
        tool: c.function.name,
        raw: c.function.arguments?.slice(0, 200),
      });
    }
    return { id: c.id, name: c.function.name, input };
  });
}

export class GroqProvider implements LlmProvider {
  readonly name = 'groq';
  readonly agentModel: string;
  readonly fastModel: string;
  private readonly apiKey: string;

  constructor() {
    if (!env.GROQ_API_KEY) {
      throw new ProviderNotConfiguredError('Groq', 'GROQ_API_KEY');
    }
    this.apiKey = env.GROQ_API_KEY;
    this.agentModel = env.GROQ_AGENT_MODEL;
    this.fastModel = env.GROQ_FAST_MODEL;
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const model = req.fast ? this.fastModel : this.agentModel;
    const startedAt = Date.now();

    const body: Record<string, unknown> = {
      model,
      messages: req.messages.map(toWireMessage),
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.3,
    };

    if (req.tools?.length) {
      body.tools = req.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = 'auto';
    }

    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `Groq request failed (${res.status}): ${detail.slice(0, 500)}`
      );
    }

    const json = (await res.json()) as OpenAiResponse;
    const choice = json.choices?.[0];

    if (!choice) {
      throw new Error('Groq returned no choices');
    }

    const usage: ProviderUsage = {
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
      cachedInputTokens: json.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      totalTokens: json.usage?.total_tokens ?? 0,
    };

    return {
      text: choice.message.content,
      toolCalls: parseToolCalls(choice.message.tool_calls),
      usage,
      model: json.model || model,
      finishReason: mapFinishReason(choice.finish_reason),
      latencyMs: Date.now() - startedAt,
    };
  }

  costUsd(model: string, usage: ProviderUsage): number {
    const price = PRICE_PER_MTOK[model] ?? FALLBACK_PRICE;
    const billableInput = Math.max(usage.inputTokens - usage.cachedInputTokens, 0);
    // Cached input, where the provider reports it, is billed at a discount.
    const cachedCost = (usage.cachedInputTokens / 1_000_000) * price.input * 0.5;
    const inputCost = (billableInput / 1_000_000) * price.input;
    const outputCost = (usage.outputTokens / 1_000_000) * price.output;
    return inputCost + cachedCost + outputCost;
  }
}
