/**
 * 知识库 MCP Client —— 单例 + 懒加载 + 自动重连。
 * 通过 stdio transport 启动一个外部开源 MCP 进程，把它的工具暴露给子 agent。
 *
 * 配置（环境变量）：
 *   KB_MCP_COMMAND   必填，例如 "npx"、"node"、"python"
 *   KB_MCP_ARGS      JSON 数组字符串，例如 ["-y","some-knowledge-mcp"]；或空格分隔的字符串
 *   KB_MCP_ENV       JSON 对象字符串，注入到子进程环境（如 token 等）
 *   KB_MCP_CWD       可选：子进程 cwd
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface KbMcpConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
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

function parseArgs(raw: string | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) return arr.map((x) => String(x));
    } catch {
      // fall back to space split
    }
  }
  return trimmed.split(/\s+/).filter(Boolean);
}

function parseEnv(raw: string | undefined): Record<string, string> | undefined {
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
  const command = process.env.KB_MCP_COMMAND;
  if (!command) return undefined;
  return {
    command,
    args: parseArgs(process.env.KB_MCP_ARGS),
    env: parseEnv(process.env.KB_MCP_ENV),
    cwd: process.env.KB_MCP_CWD,
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
      const transport = new StdioClientTransport({
        command: this.cfg.command,
        args: this.cfg.args,
        env: this.cfg.env,
        cwd: this.cfg.cwd,
        stderr: "pipe",
      });
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

/** 单例（懒加载）：进程内复用同一个 KbMcpClient，避免反复 spawn */
let _shared: KbMcpClient | undefined;
export function getDefaultKbMcpClient(): KbMcpClient | undefined {
  if (_shared) return _shared;
  const cfg = loadKbMcpConfigFromEnv();
  if (!cfg) return undefined;
  _shared = new KbMcpClient(cfg);
  return _shared;
}
