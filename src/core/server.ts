import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import apiRegistry from './registry';

/**
 * MCP服务器配置接口
 */
export interface McpServerConfig {
  /**
   * 服务器名称
   */
  name: string;
  
  /**
   * 服务器版本
   */
  version: string;
  
  /**
   * 是否显示调试日志
   */
  debug?: boolean;
}

/**
 * MCP服务器默认配置
 */
const DEFAULT_CONFIG: McpServerConfig = {
  name: "DynamicApiServer",
  version: "1.0.0",
  debug: false
};

/**
 * MCP服务器类 - 提供API元工具和交互能力
 */
export class ApiServer {
  private server: McpServer;
  private transport: StdioServerTransport;
  private config: McpServerConfig;
  private isRunning: boolean = false;
  
  constructor(config: Partial<McpServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.server = new McpServer({
      name: this.config.name,
      version: this.config.version
    });
    this.transport = new StdioServerTransport();
  }
  
  /**
   * 初始化服务器，注册API元工具
   */
  initialize(): void {
    this.registerMetaTools();
  }
  
  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logDebug("MCP服务器已经在运行中");
      return;
    }
    
    try {
      await this.server.connect(this.transport);
      this.isRunning = true;
      this.logDebug("MCP服务器已启动");
    } catch (error) {
      console.error("启动MCP服务器失败:", error);
      throw error;
    }
  }
  
  /**
   * 停止服务器
   * 注意: McpServer API没有提供disconnect方法
   * 这里我们只能记录服务器状态，无法真正断开连接
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logDebug("MCP服务器已经停止");
      return;
    }
    
    try {
      // 由于McpServer没有断开连接的方法，我们只能标记状态
      // 实际上，当进程结束时，连接会自动关闭
      this.isRunning = false;
      this.logDebug("MCP服务器已标记为停止状态");
    } catch (error) {
      console.error("停止MCP服务器失败:", error);
    }
  }
  
  /**
   * 注册所有API元工具
   */
  private registerMetaTools(): void {
    // 1. 基础元工具：获取所有可用API列表
    this.server.tool(
      "listAllApis",
      "列出所有可用的API接口",
      {},
      async () => {
        try {
          // 获取简化的API列表
          const apis = apiRegistry.getAllApiIds().map(id => {
            const apiInfo = apiRegistry.getApiInfo(id);
            return {
              id,
              name: apiInfo?.name || id,
              description: apiInfo?.description || "",
              category: apiInfo?.category || "未分类"
            };
          });
          
          // 按分类组织成对象结构
          const groupedApis: Record<string, Array<{id: string, name: string, description: string}>> = {};
          
          // 先对apis进行分组
          apis.forEach(api => {
            if (!groupedApis[api.category]) {
              groupedApis[api.category] = [];
            }
            // 保存完整的API对象信息
            groupedApis[api.category].push({
              id: api.id,
              name: api.name,
              description: api.description
            });
          });
          
          // 构建JSON格式响应
          const response = {
            instruction: "必须使用getApiDetails工具获取API的完整参数信息后再调用API,禁止直接调用未充分了解的API",
            categories: Object.keys(groupedApis).map(category => ({
              name: category,
              apis: groupedApis[category]
            }))
          };
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(response, null, 2)
            }]
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{
              type: "text",
              text: `错误: 获取API列表失败 - ${errorMessage}`
            }]
          };
        }
      }
    );
    
    // 2. 基础元工具：获取特定API的详细信息
    this.server.tool(
      "getApiDetails",
      "获取特定API的详细信息和使用方法",
      {
        apiId: z.string().describe("API的唯一标识符")
      },
      async ({ apiId }: { apiId: string }) => {
        try {
          const apiInfo = apiRegistry.getApiInfo(apiId);
          
          if (!apiInfo) {
            return {
              content: [{ 
                type: "text" as const, 
                text: `错误: 未找到ID为 ${apiId} 的API`
              }]
            };
          }
          
          return {
            content: [{ 
              type: "text" as const, 
              text: `${JSON.stringify(apiInfo, null, 2)}`
            }]
          };
        } catch (error: any) {
          return {
            content: [{ 
              type: "text" as const, 
              text: `错误: 获取API详情失败 - ${error?.message || error}`
            }]
          };
        }
      }
    );
    
    // 3. 基础元工具：执行API
    this.server.tool(
      "executeApi",
      "执行指定的API,需要提供API的ID和参数",
      {
        apiId: z.string().describe("要执行的API的唯一标识符"),
        params: z.record(z.any()).optional().describe("API的参数")
      },
      async ({ apiId, params = {} }: { apiId: string; params?: Record<string, any> }) => {
        try {
          const result = await apiRegistry.executeApi(apiId, params);
          
          return {
            content: [{ type: "text" as const, text: result }]
          };
        } catch (error: any) {
          return {
            content: [{ 
              type: "text" as const, 
              text: `错误: ${error?.message || error}`
            }]
          };
        }
      }
    );
    
    this.logDebug("已注册API元工具");
  }
  
  /**
   * 输出调试日志
   */
  private logDebug(message: string): void {
    if (this.config.debug) {
      console.log(`[Debug] ${message}`);
    }
  }
}

// 导出默认服务器实例
const defaultServer = new ApiServer();
export default defaultServer; 