/**
 * 知识库 MCP Client —— 单例 + 懒加载 + 自动重连。
 * 通过 Streamable HTTP transport 连接远端 MCP 服务，把它的工具暴露给子 agent。
 *
 * 配置（环境变量）：
 *   KB_MCP_URL      必填，例如 "http://localhost:8782/mcp"
 *   KB_MCP_HEADERS  JSON 对象字符串，附加到每次请求的 HTTP 头，例如 {"Authorization":"Bearer xxx"}
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface KbMcpConfig {
  url: string;
  headers?: Record<string, string>;
  /** 客户端展示名 */
  name?: string;
  /** 客户端版本 */
  version?: string;
}

export interface KbToolInfo {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

function parseHeaders(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) out[k] = String(v);
      return out;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export function loadKbMcpConfigFromEnv(): KbMcpConfig | undefined {
  const url = process.env.KB_MCP_URL;
  if (!url) return undefined;
  return {
    url,
    headers: parseHeaders(process.env.KB_MCP_HEADERS),
    name: "dynamic-api-gateway-kb-client",
    version: "1.0.0",
  };
}

export class KbMcpClient {
  private client?: Client;
  private connecting?: Promise<Client>;
  private toolsCache?: KbToolInfo[];
  private readonly cfg: KbMcpConfig;

  constructor(cfg: KbMcpConfig) {
    this.cfg = cfg;
  }

  isConnected(): boolean {
    return !!this.client;
  }

  async ensureConnected(): Promise<Client> {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const transport = new StreamableHTTPClientTransport(
        new URL(this.cfg.url),
        {
          requestInit: {
            headers: this.cfg.headers,
          },
        }
      );
      const client = new Client(
        { name: this.cfg.name ?? "kb-client", version: this.cfg.version ?? "1.0.0" },
        { capabilities: {} }
      );
      try {
        await client.connect(transport);
      } catch (e) {
        this.connecting = undefined;
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`知识库 MCP 连接失败: ${msg}`);
      }
      this.client = client;
      this.toolsCache = undefined;
      return client;
    })();

    try {
      return await this.connecting;
    } finally {
      this.connecting = undefined;
    }
  }

  async listTools(force = false): Promise<KbToolInfo[]> {
    if (!force && this.toolsCache) return this.toolsCache;
    const client = await this.ensureConnected();
    const r = await client.listTools();
    this.toolsCache = (r.tools ?? []).map((t: any) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema ?? { type: "object", properties: {} },
    }));
    return this.toolsCache;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const client = await this.ensureConnected();
    const r = await client.callTool({ name, arguments: args });
    // MCP CallToolResult: { content: [{ type, text }], isError? }
    const parts = (r.content ?? []) as Array<{ type: string; text?: string }>;
    const text = parts
      .map((p) => (p.type === "text" && typeof p.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n");
    if ((r as any).isError) {
      return JSON.stringify({ error: text || "tool error", isError: true });
    }
    return text || JSON.stringify(r);
  }

  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        /* ignore */
      }
    }
    this.client = undefined;
    this.toolsCache = undefined;
  }
}

/** 单例（懒加载）：进程内复用同一个 KbMcpClient，避免反复建连 */
let _shared: KbMcpClient | undefined;
export function getDefaultKbMcpClient(): KbMcpClient | undefined {
  if (_shared) return _shared;
  const cfg = loadKbMcpConfigFromEnv();
  if (!cfg) return undefined;
  _shared = new KbMcpClient(cfg);
  return _shared;
}
