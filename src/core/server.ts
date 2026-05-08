import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import apiRegistry from "./registry";

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
    const server = new McpServer({
      name: this.config.name,
      version: this.config.version,
    });
    this.registerMetaToolsOn(server);
    return server;
  }

  private registerMetaToolsOn(server: McpServer): void {
    server.registerTool(
      "listAllApis",
      {
        description: "列出所有可用的API接口",
        inputSchema: {},
      },
      async () => {
        try {
          const apis = apiRegistry.getAllApiIds().map((id) => {
            const apiInfo = apiRegistry.getApiInfo(id);
            return {
              id,
              name: apiInfo?.name || id,
              description: apiInfo?.description || "",
              category: apiInfo?.category || "未分类",
            };
          });

          const apiCatalog: Record<
            string,
            Array<{ id: string; name: string; description: string }>
          > = {};

          apis.forEach((api) => {
            if (!apiCatalog[api.category]) {
              apiCatalog[api.category] = [];
            }
            apiCatalog[api.category].push({
              id: api.id,
              name: api.name,
              description: api.description,
            });
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(apiCatalog, null, 2),
              },
            ],
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text",
                text: `错误: 获取API列表失败 - ${errorMessage}`,
              },
            ],
          };
        }
      }
    );

    server.registerTool(
      "getApiDetails",
      {
        description: "获取特定API的详细信息和使用方法",
        inputSchema: {
          apiId: z.string().describe("API的唯一标识符"),
        },
      },
      async ({ apiId }) => {
        try {
          const apiInfo = apiRegistry.getApiInfo(apiId);

          if (!apiInfo) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `错误: 未找到ID为 ${apiId} 的API`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text" as const,
                text: `${JSON.stringify(apiInfo, null, 2)}`,
              },
            ],
          };
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text" as const,
                text: `错误: 获取API详情失败 - ${msg}`,
              },
            ],
          };
        }
      }
    );

    server.registerTool(
      "executeApi",
      {
        description: "执行指定的API,需要提供API的ID和参数",
        inputSchema: {
          apiId: z.string().describe("要执行的API的唯一标识符"),
          params: z
            .record(z.string(), z.unknown())
            .optional()
            .describe("API的参数"),
        },
      },
      async ({ apiId, params = {} }) => {
        try {
          const result = await apiRegistry.executeApi(
            apiId,
            params as Record<string, unknown>
          );
          return {
            content: [{ type: "text" as const, text: result }],
          };
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text" as const,
                text: `错误: ${msg}`,
              },
            ],
          };
        }
      }
    );

    this.logDebug("已注册API元工具");
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
