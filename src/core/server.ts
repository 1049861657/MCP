import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import apiRegistry, { type ProgressCallback } from "./registry";

/**
 * MCP 服务器配置（Streamable HTTP）
 */
export interface McpServerConfig {
  name: string;
  version: string;
  debug?: boolean;
  /** 监听地址，默认读取 MCP_HOST，否则 127.0.0.1 */
  host?: string;
  /** 监听端口，默认读取 MCP_PORT，否则 8080 */
  port?: number;
  /** MCP HTTP 端点路径，默认 /mcp（见 MCP Streamable HTTP 规范） */
  mcpPath?: string;
}

const DEFAULT_CONFIG: McpServerConfig = {
  name: "DynamicApiServer",
  version: "1.0.0",
};

/**
 * 基于 Streamable HTTP 的 MCP 服务（参见 SDK server.md / Streamable HTTPServerTransport）
 */
export class ApiServer {
  private config: McpServerConfig;
  private isRunning = false;
  private httpServer?: Server;
  private readonly transports: Record<string, StreamableHTTPServerTransport> = {};

  constructor(config: Partial<McpServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 预留钩子；元工具在每条会话的 createMcpServer() 中注册。
   */
  initialize(): void {}

  /**
   * 为当前会话构造 MCP 实例并注册元工具。
   */
  private createMcpServer(): McpServer {
    const server = new McpServer(
      { name: this.config.name, version: this.config.version },
      {
        // instructions 随 initialize 响应发送，客户端自动注入系统 prompt
        instructions:
          "This server exposes business APIs through three meta-tools: " +
          "listAllApis (discover), getApiDetails (inspect params), executeApi (run). " +
          "Rule 1: When apiId is unknown, always call listAllApis first. " +
          "Rule 2: Call getApiDetails before executeApi to confirm required params and their sources. " +
          "Rule 3: When any response includes nextHint, follow it before asking the user. " +
          "Rule 4: Never call state-mutating APIs (add/update/delete/reset) without explicit user authorization.",
      }
    );
    this.registerMetaToolsOn(server);
    return server;
  }

  private registerMetaToolsOn(server: McpServer): void {
    // L0：极致精简 description——关键词命中即可，避免预占常驻 token
    server.registerTool(
      "listAllApis",
      {
        description:
          "List available API IDs grouped by category. Call first when unsure which apiId to use.",
        inputSchema: {},
        annotations: { readOnlyHint: true },
      },
      async () => {
        try {
          const apiCatalog: Record<
            string,
            Array<{ id: string; name: string; description?: string }>
          > = {};

          for (const id of apiRegistry.getAllApiIds()) {
            const info = apiRegistry.getApiInfo(id);
            const category = info?.category || "未分类";
            const desc = (info?.description || "").trim();
            const entry: { id: string; name: string; description?: string } = {
              id,
              name: info?.name || id,
            };
            // L4：长描述截断到 80 字以内；空 description 不输出，节省 token
            if (desc) {
              entry.description = desc.length > 80 ? desc.slice(0, 77) + "..." : desc;
            }
            (apiCatalog[category] ||= []).push(entry);
          }

          // 按分类、id 排序，输出稳定可缓存
          for (const cat of Object.keys(apiCatalog)) {
            apiCatalog[cat].sort((a, b) => a.id.localeCompare(b.id));
          }

          const total = Object.values(apiCatalog).reduce((n, arr) => n + arr.length, 0);
          const payload = {
            total,
            catalog: apiCatalog,
            // L4 nextHint：惰性引导，仅在调用时短暂出现
            nextHint:
              total === 0
                ? "No APIs registered yet."
                : "Pick an apiId, then call getApiDetails(apiId) to inspect its parameters before executeApi.",
          };

          return {
            content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { error: `获取API列表失败: ${msg}`, nextHint: "Retry later or check server logs." },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }
    );

    server.registerTool(
      "getApiDetails",
      {
        description:
          "Get parameters and examples for a given apiId. Call before executeApi to confirm required params.",
        inputSchema: {
          apiId: z.string().describe("API的唯一标识符"),
        },
        annotations: { readOnlyHint: true },
      },
      async ({ apiId }) => {
        try {
          const apiInfo = apiRegistry.getApiInfo(apiId);

          if (!apiInfo) {
            const candidates = apiRegistry
              .getAllApiIds()
              .filter((id) => id.toLowerCase().includes(apiId.toLowerCase()))
              .slice(0, 5);
            return {
              isError: true,
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      error: `未找到ID为 ${apiId} 的API`,
                      candidates,
                      nextHint:
                        candidates.length > 0
                          ? "Try one of the candidate IDs above, or call listAllApis to browse."
                          : "Call listAllApis to see what is registered.",
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          const required = (apiInfo.parameters || [])
            .filter((p) => p.required)
            .map((p) => p.name);

          // L4：仅返回首条 example，避免响应膨胀；客户端若需更多可二次调用
          const compactExamples = apiInfo.examples?.slice(0, 1);

          const payload = {
            ...apiInfo,
            examples: compactExamples,
            requiredParams: required,
            nextHint:
              required.length > 0
                ? `Required params: [${required.join(", ")}]. Call executeApi("${apiInfo.id}", { ... }).`
                : `No required params. Call executeApi("${apiInfo.id}") to run.`,
          };

          return {
            content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
          };
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { error: `获取API详情失败: ${msg}`, nextHint: "Verify apiId via listAllApis." },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }
    );

    server.registerTool(
      "executeApi",
      {
        description:
          "Run apiId with params. Call after getApiDetails confirmed the required schema.",
        inputSchema: {
          apiId: z.string().describe("要执行的API的唯一标识符"),
          params: z
            .record(z.string(), z.unknown())
            .optional()
            .describe("API的参数对象；缺省即空"),
        },
      },
      // extra: RequestHandlerExtra — 含 _meta.progressToken（客户端约定：所有 executeApi 调用均携带）与 sendNotification
      async ({ apiId, params = {} }, extra: any) => {
        const progressToken = extra?._meta?.progressToken as string | number | undefined;
        const onProgress: ProgressCallback | undefined = progressToken != null
          ? async (progress, total, message) => {
              try {
                await extra.sendNotification({
                  method: "notifications/progress",
                  params: {
                    progressToken,
                    progress,
                    total,
                    ...(message ? { message } : {}),
                  },
                });
              } catch {
                // progress 通知失败不应中断主流程
              }
            }
          : undefined;

        try {
          const result = await apiRegistry.executeApi(
            apiId,
            params as Record<string, unknown>,
            onProgress
          );
          // 处理器已返回字符串（通常为 JSON），透传以保持响应紧凑
          return {
            content: [{ type: "text" as const, text: result }],
          };
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          // L4：把"缺参"错误结构化，附加修复建议，让模型可自愈
          const missingMatch = /缺少必需参数:\s*(.+)/.exec(msg);
          const missing = missingMatch
            ? missingMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
            : [];
          const nextHint =
            missing.length > 0
              ? `Missing params [${missing.join(", ")}]. Call getApiDetails("${apiId}") for parameter source/type, then retry executeApi.`
              : `Re-check apiId via getApiDetails("${apiId}") and retry.`;

          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { error: msg, missingParams: missing, nextHint },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }
    );

    this.logDebug("已注册 API 元工具");
  }

  /**
   * 启动 Streamable HTTP（有状态会话：initialize 分配 session，后续请求带 mcp-session-id）
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logDebug("MCP 已在运行");
      return;
    }

    const host = this.config.host ?? process.env.MCP_HOST ?? "127.0.0.1";
    const port = this.config.port ?? Number(process.env.MCP_PORT ?? "8080");
    const mcpPath = this.config.mcpPath ?? "/mcp";

    const app = createMcpExpressApp({ host });

    app.post(mcpPath, (req: Request, res: Response) => {
      void this.handleMcpPost(req, res);
    });
    app.get(mcpPath, (req: Request, res: Response) => {
      void this.handleMcpGet(req, res);
    });
    app.delete(mcpPath, (req: Request, res: Response) => {
      void this.handleMcpDelete(req, res);
    });

    await new Promise<void>((resolve, reject) => {
      const srv = app.listen(port, host, () => resolve());
      this.httpServer = srv;
      srv.once("error", reject);
    });

    this.isRunning = true;
    const url = `http://${host}:${port}${mcpPath}`;
    console.log(`MCP Streamable HTTP 端点: ${url}`);
    this.logDebug(`监听 ${url}`);
  }

  private async handleMcpPost(req: Request, res: Response): Promise<void> {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    try {
      if (sessionId && this.transports[sessionId]) {
        await this.transports[sessionId].handleRequest(req, res, req.body);
        return;
      }

      if (!sessionId && isInitializeRequest(req.body)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            this.transports[sid] = transport;
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && this.transports[sid]) {
            delete this.transports[sid];
          }
        };

        const mcp = this.createMcpServer();
        await mcp.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
    } catch (error) {
      console.error("MCP POST 处理失败:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  }

  private async handleMcpGet(req: Request, res: Response): Promise<void> {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !this.transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    try {
      await this.transports[sessionId].handleRequest(req, res);
    } catch (error) {
      console.error("MCP GET (SSE) 处理失败:", error);
      if (!res.headersSent) {
        res.status(500).send("Internal server error");
      }
    }
  }

  private async handleMcpDelete(req: Request, res: Response): Promise<void> {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !this.transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    try {
      await this.transports[sessionId].handleRequest(req, res);
    } catch (error) {
      console.error("MCP DELETE 处理失败:", error);
      if (!res.headersSent) {
        res.status(500).send("Error processing session termination");
      }
    }
  }

  async stop(): Promise<void> {
    const ids = Object.keys(this.transports);
    for (const sid of ids) {
      try {
        await this.transports[sid]?.close();
      } catch {
        /* ignore */
      }
      delete this.transports[sid];
    }

    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
      this.httpServer = undefined;
    }

    this.isRunning = false;
    this.logDebug("HTTP 服务已停止");
  }

  private logDebug(message: string): void {
    if (this.config.debug) {
      console.log(`[Debug] ${message}`);
    }
  }
}

const defaultServer = new ApiServer();
export default defaultServer;
