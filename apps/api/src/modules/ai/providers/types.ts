/**
 * Provider-neutral contract for the garage agent.
 *
 * The agent core never imports a vendor SDK directly — it talks to LlmProvider.
 * Groq is the initial driver; swapping to Claude (or running both) is a factory
 * change in ./index.ts, not a rewrite of the tools or the agent loop.
 */

/** A tool the model may call. `parameters` is a JSON Schema object. */
export interface AgentToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** A tool call the model asked for. */
export interface AgentToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type AgentRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * One turn of conversation. Assistant turns may carry toolCalls; tool turns
 * carry the result keyed back by toolCallId.
 */
export interface AgentMessage {
  role: AgentRole;
  content: string | null;
  toolCalls?: AgentToolCall[];
  toolCallId?: string;
  /** Provider-specific blocks (reasoning, etc.) preserved verbatim for replay. */
  providerBlocks?: unknown;
}

/** Token counts as reported by the provider — never estimated locally. */
export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  totalTokens: number;
}

export type FinishReason = 'stop' | 'tool_calls' | 'length' | 'refusal' | 'other';

export interface ChatResult {
  text: string | null;
  toolCalls: AgentToolCall[];
  usage: ProviderUsage;
  model: string;
  finishReason: FinishReason;
  latencyMs: number;
}

export interface ChatRequest {
  messages: AgentMessage[];
  tools?: AgentToolDef[];
  /** Use the cheap model (reranking, titles) instead of the agent model. */
  fast?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Stable prefix hint; providers that support prompt caching use it. */
  cacheableSystemPrefix?: boolean;
}

export interface LlmProvider {
  readonly name: string;
  readonly agentModel: string;
  readonly fastModel: string;
  chat(req: ChatRequest): Promise<ChatResult>;
  /** Cost in USD for a completed call. */
  costUsd(model: string, usage: ProviderUsage): number;
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string, envVar: string) {
    super(`${provider} is not configured — set ${envVar} in apps/api/.env`);
    this.name = 'ProviderNotConfiguredError';
  }
}
