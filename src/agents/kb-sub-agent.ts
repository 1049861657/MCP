/**
 * 知识库子 agent —— ReAct 循环：
 *  1) 一次性把远程知识库 MCP 的工具列表喂给 LLM
 *  2) LLM 决策调用哪些工具；本地通过 MCP Client 执行；把结果回灌
 *  3) 直至 LLM 返回最终答案、达到 maxSteps、超时、或检测到死循环
 *
 * 设计取舍：
 *  - 默认 maxSteps=10、timeoutMs=180s（保证多步检索的同时控制延迟与 token）
 *  - 死循环防护：连续 3 次相同 tool+args，或同一签名累计调用 4 次，强制结束
 *  - 单工具响应过长时截断（KB_TOOL_RESULT_MAX_CHARS，默认 10000），避免 context 爆炸
 *  - 强制收尾：最后一轮要求 LLM 直接回答、禁止再调工具
 */

import { LlmProvider, getDefaultLlm, ChatMessage, ToolDef, ToolCall } from "./llm-provider";
import { KbMcpClient, KbToolInfo, getDefaultKbMcpClient } from "./kb-mcp-client";
import type { ProgressCallback } from "../core/registry";

const SYSTEM_PROMPT = [
  "你是一个嵌入在 MCP 网关内的知识库只读问答 agent。",
  "你的唯一职责：通过知识库检索工具，准确回答用户问题。严禁调用任何写入/修改/删除类工具。",
  "",
  "【推荐检索步骤】",
  "1. 用 mindos_search_notes 搜索关键词，快速定位相关文档（返回摘要片段）。",
  "   - 若一次未命中，换同义词或拆分关键词再搜一次；最多搜 2-3 次不同关键词。",
  "2. 根据搜索摘要判断文档相关性：",
  "   - 若摘要已足够回答问题 → 直接给出答案，无需读取原文。",
  "   - 若需要原文细节，优先使用 mindos_read_lines 读取感兴趣的行范围（避免读取整个大文件）。",
  "   - 仅当文件明确较短或需要全文时，才使用 mindos_read_file。",
  "3. 若需了解目录结构或找到关联文档，可用 mindos_list_files 或 mindos_get_backlinks。",
  "4. 综合所有检索结果，一次性给出完整答案，并标注引用来源（文件路径）。",
  "",
  "【大文件处理策略 - 重要】",
  "当需要读取可能较长的文档时，请用 mindos_read_lines 分段读取而非一次性 read_file：",
  "  - 先读前 60 行了解文档结构和目录（start_line=1, end_line=60）",
  "  - 根据目录定位相关章节，再读该章节的具体行范围",
  "  - 这样可以精准获取所需内容，避免 context 被无关内容占满",
  "",
  "【严格禁止】",
  "- 禁止调用 mindos_write_file / mindos_create_file / mindos_update_* / mindos_insert_* /",
  "  mindos_append_* / mindos_delete_* / mindos_rename_* / mindos_move_* / mindos_create_space /",
  "  mindos_rename_space / mindos_lint / mindos_compile / mindos_bootstrap 等非读取工具。",
  "- 禁止编造未经检索证实的内容；找不到时明确告知。",
  "- 禁止重复调用相同工具+相同参数。",
  "- 信息已充分时立即停止调用工具，给出最终答案。",
].join("\n");

export interface SubAgentOptions {
  maxSteps?: number;
  /** 每步 LLM 调用的超时（毫秒），完成一步后重置，默认 60s */
  timeoutMs?: number;
  toolResultMaxChars?: number;
  /** 开启详细模式：trace 中填充 resultSnippet、stepLogs */
  verbose?: boolean;
  /** resultSnippet 最大字符数，默认 300 */
  snippetMaxChars?: number;
  /**
   * 进度回调：每完成一个检索步骤后触发，驱动客户端 MCP SDK 的 resetTimeoutOnProgress。
   * 由 server 层从 progressToken 构建后透传，不存在时静默跳过。
   */
  onProgress?: ProgressCallback;
}

export interface SubAgentTrace {
  step: number;
  tool: string;
  args: Record<string, unknown>;
  /** 工具调用耗时（毫秒） */
  durationMs: number;
  truncated: boolean;
  /** 工具返回结果的前 N 字片段（verbose 模式填充） */
  resultSnippet?: string;
}

export interface SubAgentStepLog {
  step: number;
  /** 本步 LLM 调用耗时（毫秒） */
  llmMs: number;
  /** LLM 本步决策调用的工具数量 */
  toolCallCount: number;
  /** LLM 在调用工具前输出的思考文本（如果有） */
  llmThought?: string;
}

export interface SubAgentResult {
  answer: string;
  steps: number;
  finishReason: "answered" | "max_steps" | "timeout" | "loop_guard" | "no_llm" | "no_kb" | "error";
  trace: SubAgentTrace[];
  /** 每步 LLM 调用的摘要，verbose 模式填充 */
  stepLogs?: SubAgentStepLog[];
  truncated?: boolean;
  error?: string;
}

/**
 * 问答场景只需要读取类工具；写入/修改/删除工具不暴露给 LLM，节省 token 并防止误操作。
 * 以白名单为准：列表中的工具才会传给 LLM。
 */
const READ_TOOL_WHITELIST = new Set([
  "mindos_search_notes",
  "mindos_list_files",
  "mindos_list_spaces",
  "mindos_read_file",
  "mindos_read_lines",
  "mindos_get_recent",
  "mindos_get_backlinks",
  "mindos_get_history",
  "mindos_get_file_at_version",
]);

function filterReadOnlyTools(tools: KbToolInfo[]): KbToolInfo[] {
  const matched = tools.filter((t) => READ_TOOL_WHITELIST.has(t.name));
  // 白名单工具都不存在时（MCP 工具命名不同），降级为全量暴露避免功能失效
  return matched.length > 0 ? matched : tools;
}

function toToolDef(t: KbToolInfo): ToolDef {
  return {
    type: "function",
    function: {
      name: t.name,
      description: t.description ?? "",
      parameters:
        (t.inputSchema as Record<string, unknown>) ?? {
          type: "object",
          properties: {},
        },
    },
  };
}

function safeParseArgs(raw: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function truncate(s: string, max: number): { text: string; truncated: boolean } {
  if (s.length <= max) return { text: s, truncated: false };
  return { text: s.slice(0, max) + "\n…[truncated]", truncated: true };
}

export class KnowledgeSubAgent {
  constructor(
    private readonly llm: LlmProvider,
    private readonly kb: KbMcpClient
  ) {}

  async ask(question: string, opts: SubAgentOptions = {}): Promise<SubAgentResult> {
    const maxSteps = opts.maxSteps ?? 10;
    const stepTimeoutMs = opts.timeoutMs ?? 60_000;
    const toolResultMax =
      opts.toolResultMaxChars ?? Number(process.env.KB_TOOL_RESULT_MAX_CHARS ?? "10000");
    const verbose = opts.verbose ?? process.env.KB_VERBOSE === "1";
    const snippetMax = opts.snippetMaxChars ?? 300;
    const debug = process.env.KB_DEBUG === "1";
    const { onProgress } = opts;

    const log = (msg: string) => {
      if (debug) {
        const now = new Date();
        const pad = (n: number, len = 2) => String(n).padStart(len, "0");
        const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
        console.log(`[KB-Agent ${ts}] ${msg}`);
      }
    };

    const trace: SubAgentTrace[] = [];
    const stepLogs: SubAgentStepLog[] = [];

    log(`▶ 开始问答 question="${question}" maxSteps=${maxSteps} stepTimeoutMs=${stepTimeoutMs}`);

    let kbTools: KbToolInfo[];
    try {
      kbTools = await this.kb.listTools();
    } catch (e) {
      return {
        answer: "",
        steps: 0,
        finishReason: "no_kb",
        trace,
        error: e instanceof Error ? e.message : String(e),
      };
    }
    if (kbTools.length === 0) {
      return {
        answer: "",
        steps: 0,
        finishReason: "no_kb",
        trace,
        error: "知识库 MCP 未暴露任何工具",
      };
    }

    const readOnlyTools = filterReadOnlyTools(kbTools);
    log(
      `  知识库工具列表(${kbTools.length}总/${readOnlyTools.length}可用): ${readOnlyTools.map((t) => t.name).join(", ")}`
    );
    const tools = readOnlyTools.map(toToolDef);
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: question },
    ];

    // 记录每个工具签名的累计调用次数，同一签名累计 >=3 次视为死循环
    const sigCounts = new Map<string, number>();
    let lastSig = "";
    let consecutiveDupCount = 0;

    for (let step = 1; step <= maxSteps; step++) {
      log(`  → Step ${step}/${maxSteps}: 调用 LLM (stepTimeoutMs=${stepTimeoutMs}ms)`);
      const llmT0 = Date.now();
      let resp;
      try {
        resp = await this.llm.chat({ messages, tools, timeoutMs: stepTimeoutMs });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        log(`  ✗ Step ${step}: LLM 调用超时/失败 error="${errMsg}"，触发强制收尾`);
        return this.finalize(messages, trace, step - 1, "timeout", stepTimeoutMs, stepLogs, verbose);
      }
      const llmMs = Date.now() - llmT0;

      if (verbose || debug) {
        const isFinalAnswer = resp.toolCalls.length === 0;
        const thought = resp.content?.trim();
        const stepLog: SubAgentStepLog = {
          step,
          llmMs,
          toolCallCount: resp.toolCalls.length,
          ...(thought && !isFinalAnswer ? { llmThought: thought } : {}),
        };
        stepLogs.push(stepLog);
        log(
          `  ← Step ${step}: LLM 完成 llmMs=${llmMs} toolCalls=${resp.toolCalls.length}` +
            (resp.toolCalls.length
              ? ` tools=[${resp.toolCalls.map((tc) => tc.function.name).join(", ")}]`
              : " → 直接给出答案")
        );
        if (thought && debug) {
          const label = isFinalAnswer ? "answer" : "thought";
          log(`     ${label}="${thought.slice(0, 200)}"`);
        }
      }

      // 模型决定停下并直接给答案
      if (!resp.toolCalls.length) {
        log(`  ✓ Step ${step}: 已得到最终答案`);
        // 最终答案步：发送 progress=total 表示完成
        await onProgress?.(maxSteps, maxSteps, `完成：已得到答案`).catch(() => {});
        return {
          answer: resp.content ?? "",
          steps: step,
          finishReason: "answered",
          trace,
          ...(verbose ? { stepLogs } : {}),
        };
      }

      // 把模型本轮的 tool_calls 写回 messages（OpenAI 协议要求）
      messages.push({
        role: "assistant",
        content: resp.content ?? null,
        tool_calls: resp.toolCalls,
      });

      for (const tc of resp.toolCalls) {
        const args = safeParseArgs(tc.function?.arguments ?? "");
        const sig = `${tc.function?.name}::${JSON.stringify(args)}`;
        log(`     工具调用: ${tc.function.name}(${JSON.stringify(args).slice(0, 120)})`);

        // 连续相同签名计数：连续出现 3 次触发死循环防护
        if (sig === lastSig) {
          consecutiveDupCount++;
          if (consecutiveDupCount >= 2) {
            log(`  ⚠ Step ${step}: 死循环防护触发（连续相同签名 ${consecutiveDupCount + 1} 次）`);
            return this.finalize(messages, trace, step, "loop_guard", stepTimeoutMs, stepLogs, verbose);
          }
        } else {
          lastSig = sig;
          consecutiveDupCount = 0;
        }
        // 全局签名计数：同一个 tool+args 累计调用 4 次也触发防护
        const totalCount = (sigCounts.get(sig) ?? 0) + 1;
        sigCounts.set(sig, totalCount);
        if (totalCount >= 4) {
          log(`  ⚠ Step ${step}: 死循环防护触发（相同签名累计 ${totalCount} 次）`);
          return this.finalize(messages, trace, step, "loop_guard", stepTimeoutMs, stepLogs, verbose);
        }

        const t0 = Date.now();
        let toolText: string;
        try {
          toolText = await this.kb.callTool(tc.function.name, args);
        } catch (e) {
          toolText = JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
            isError: true,
          });
        }
        const toolMs = Date.now() - t0;
        const { text, truncated } = truncate(toolText, toolResultMax);

        log(
          `     工具结果: ${tc.function.name} toolMs=${toolMs} len=${toolText.length}` +
            (truncated ? `(截断至${toolResultMax})` : "")
        );
        if (debug) log(`     结果片段: "${toolText.slice(0, 200)}"`);

        trace.push({
          step,
          tool: tc.function.name,
          args,
          durationMs: toolMs,
          truncated,
          ...(verbose ? { resultSnippet: toolText.slice(0, snippetMax) } : {}),
        });

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: text,
        });
      }

      // 本步所有工具调用完成，发送一次进度通知（重置客户端超时倒计时）
      const toolNames = resp.toolCalls.map((tc) => tc.function.name).join(", ");
      await onProgress?.(step, maxSteps, `Step ${step}/${maxSteps}: ${toolNames}`).catch(() => {});
    }

    log(`  ⚠ 达到最大轮次 maxSteps=${maxSteps}，触发强制收尾`);
    return this.finalize(messages, trace, maxSteps, "max_steps", stepTimeoutMs, stepLogs, verbose);
  }

  /**
   * 强制收尾：要求 LLM 仅基于现有上下文给最终答案，禁止再调工具。
   * deadline 用于动态计算剩余超时，避免固定 15s 在余量不足时也超时。
   */
  private async finalize(
    messages: ChatMessage[],
    trace: SubAgentTrace[],
    steps: number,
    reason: SubAgentResult["finishReason"],
    stepTimeoutMs: number,
    stepLogs: SubAgentStepLog[] = [],
    verbose = false
  ): Promise<SubAgentResult> {
    // finalize 分配步骤超时的 80%，最少 8s，最多 20s
    const finalizeTimeout = Math.min(20_000, Math.max(8_000, Math.floor(stepTimeoutMs * 0.8)));
    try {
      const r = await this.llm.chat({
        messages: [
          ...messages,
          {
            role: "user",
            content:
              "请根据上方所有工具输出，用中文给出最终简洁答案。不要再调用任何工具。",
          },
        ],
        toolChoice: "none",
        timeoutMs: finalizeTimeout,
      });
      return {
        answer: r.content ?? "",
        steps,
        finishReason: reason,
        trace,
        ...(verbose ? { stepLogs } : {}),
        truncated: true,
      };
    } catch (e) {
      return {
        answer: "",
        steps,
        finishReason: "error",
        trace,
        ...(verbose ? { stepLogs } : {}),
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}

/** 单例工厂：必要的依赖缺失时返回 undefined（由调用方降级提示） */
export function getDefaultKbAgent(): KnowledgeSubAgent | undefined {
  const llm = getDefaultLlm();
  const kb = getDefaultKbMcpClient();
  if (!llm.isConfigured() || !kb) return undefined;
  return new KnowledgeSubAgent(llm, kb);
}
