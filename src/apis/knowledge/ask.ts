import { z } from "zod";
import { ApiCategories } from "../../config/api-config";
import { getDefaultKbAgent } from "../../agents/kb-sub-agent";
import { getDefaultLlm } from "../../agents/llm-provider";
import { getDefaultKbMcpClient } from "../../agents/kb-mcp-client";
import type { ApiContext } from "../../core/registry";

function buildNextHint(
  finishReason: string,
  error?: string
): string | undefined {
  switch (finishReason) {
    case "answered":
      return undefined;
    case "no_kb":
      return "知识库 MCP 不可用：检查 KB_MCP_URL/KB_MCP_HEADERS 与服务端日志。";
    case "timeout":
      return "整体超时：可将 timeoutMs 调大至 90000-120000，或将问题拆分为更具体的子问题后重试。";
    case "max_steps":
      return "达到最大轮次但已有答案：可调大 maxSteps（建议 10-12），或将问题拆分后分别查询。";
    case "loop_guard":
      return "子 agent 触发重复调用防护：换更具体的关键词或换一种提问方式后重试。";
    case "error": {
      const msg = (error ?? "").toLowerCase();
      if (msg.includes("timeout") || msg.includes("timed out")) {
        return "LLM 调用超时：可将 timeoutMs 调大至 90000 后重试；若持续超时请检查 LLM 服务可用性。";
      }
      if (msg.includes("rate limit") || msg.includes("429")) {
        return "LLM 限速（Rate Limit）：稍等片刻后重试。";
      }
      if (msg.includes("connect") || msg.includes("econnrefused")) {
        return "网络连接失败：检查 LLM_BASE_URL 与 KB_MCP_COMMAND 对应服务是否正常运行。";
      }
      return "发生错误，可重试；若持续失败请检查服务端日志或联系运维。";
    }
    default:
      return "可重试或联系运维。";
  }
}

export default {
  id: "askKnowledgeBase",
  name: "知识库智能问答",
  description:
    "Ask the enterprise knowledge base in natural language. 内部子 agent 会自动调用知识库 MCP 检索并汇总答案。当用户问'文档/手册/wiki/操作流程/X 是什么'时使用。",
  category: ApiCategories.KNOWLEDGE,
  schema: {
    question: z.string().min(1).describe("用户问题（自然语言）"),
    maxSteps: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(10)
      .describe("子 agent 最大检索轮次"),
  },
  handler: async ({
    question,
    maxSteps,
  }: {
    question: string;
    maxSteps: number;
  }, context?: ApiContext) => {
    const { onProgress } = context ?? {};
    const verbose = process.env.KB_VERBOSE === "1";
    const snippetMaxChars = Number(process.env.KB_SNIPPET_MAX_CHARS ?? "300");
    const stepTimeoutMs = Number(process.env.KB_STEP_TIMEOUT_MS ?? "60000");

    // 前置降级提示，避免到子 agent 内部才报错
    const llmReady = getDefaultLlm().isConfigured();
    const kbReady = !!getDefaultKbMcpClient();
    if (!llmReady || !kbReady) {
      const missing: string[] = [];
      if (!llmReady) missing.push("LLM_API_KEY/OPENAI_API_KEY");
      if (!kbReady) missing.push("KB_MCP_URL");
      return JSON.stringify(
        {
          error: "知识库子 agent 未就绪",
          missing,
          nextHint:
            "在服务端环境变量中配置 LLM_API_KEY（可选 LLM_BASE_URL/LLM_MODEL）与 KB_MCP_URL/KB_MCP_HEADERS，重启后再试。",
        },
        null,
        2
      );
    }

    const agent = getDefaultKbAgent();
    if (!agent) {
      return JSON.stringify(
        { error: "子 agent 初始化失败", nextHint: "检查服务端日志" },
        null,
        2
      );
    }

    const t0 = Date.now();
    const result = await agent.ask(question, { maxSteps, timeoutMs: stepTimeoutMs, verbose, snippetMaxChars, onProgress });
    const durationMs = Date.now() - t0;

    const payload = {
      answer: result.answer,
      steps: result.steps,
      finishReason: result.finishReason,
      durationMs,
      truncated: !!result.truncated,
      trace: verbose
        ? result.trace.map((t) => ({
            step: t.step,
            tool: t.tool,
            args: t.args,
            ms: t.durationMs,
            truncated: t.truncated,
            ...(t.resultSnippet !== undefined ? { resultSnippet: t.resultSnippet } : {}),
          }))
        : result.trace.map((t) => ({ step: t.step, tool: t.tool, ms: t.durationMs })),
      ...(verbose && result.stepLogs?.length ? { stepLogs: result.stepLogs } : {}),
      ...(result.error ? { error: result.error } : {}),
      nextHint: buildNextHint(result.finishReason, result.error),
    };

    return JSON.stringify(payload, null, 2);
  },
  examples: [
    {
      description: "限制轮次",
      params: { question: "T+0 与 T+1 的差异？", maxSteps: 3 },
    },
  ],
};
