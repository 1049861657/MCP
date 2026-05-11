/**
 * LLM Provider —— 使用 openai 官方 SDK，兼容 OpenAI 协议的任意端点。
 * 凭证优先级：构造参数 > 环境变量（LLM_API_KEY / LLM_BASE_URL / LLM_MODEL）
 */

import OpenAI from "openai";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: ChatRole;
  content?: string | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolDef[];
  toolChoice?: "auto" | "none" | "required";
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface ChatResponse {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export interface LlmProviderConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  defaultTimeoutMs?: number;
  debug?: boolean;
}

export class LlmProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly defaultTimeoutMs: number;
  private readonly debug: boolean;

  constructor(cfg: LlmProviderConfig = {}) {
    const apiKey = cfg.apiKey ?? process.env.LLM_API_KEY ?? "";
    const baseURL = cfg.baseURL ?? process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
    this.model = cfg.model ?? process.env.LLM_MODEL ?? "gpt-4o-mini";
    this.defaultTimeoutMs = cfg.defaultTimeoutMs ?? 60_000;
    this.debug = cfg.debug ?? false;

    this.client = new OpenAI({ apiKey, baseURL });
  }

  isConfigured(): boolean {
    return !!this.client.apiKey;
  }

  getModel(): string {
    return this.model;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    if (!this.isConfigured()) {
      throw new Error(
        "LLM 未配置：请设置环境变量 LLM_API_KEY，可选 LLM_BASE_URL / LLM_MODEL"
      );
    }

    const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: this.model,
      messages: req.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: req.temperature ?? 0.2,
    };
    if (req.tools && req.tools.length > 0) {
      params.tools = req.tools as OpenAI.Chat.ChatCompletionTool[];
      params.tool_choice = req.toolChoice ?? "auto";
    }
    if (req.maxTokens) params.max_tokens = req.maxTokens;

    const timeout = req.timeoutMs ?? this.defaultTimeoutMs;
    const r = await this.client.chat.completions.create(params, { timeout });

    const choice = r.choices[0];
    const msg = choice.message;
    const toolCalls: ToolCall[] = (msg.tool_calls ?? [])
      .filter((tc) => tc.type === "function" && "function" in tc)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((tc: any) => ({
        id: tc.id as string,
        type: "function" as const,
        function: { name: tc.function.name as string, arguments: tc.function.arguments as string },
      }));

    if (this.debug) {
      console.log(`[LLM] model=${this.model} finish=${choice.finish_reason} tools=${toolCalls.length} total_tokens=${r.usage?.total_tokens}`);
    }

    return {
      content: msg.content ?? null,
      toolCalls,
      finishReason: choice.finish_reason,
      usage: r.usage ?? undefined,
    };
  }
}

let _shared: LlmProvider | undefined;
export function getDefaultLlm(): LlmProvider {
  if (!_shared) {
    _shared = new LlmProvider({ debug: process.env.LLM_DEBUG === "1" });
  }
  return _shared;
}
