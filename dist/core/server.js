"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiServer = void 0;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const registry_1 = __importDefault(require("./registry"));
/**
 * MCP服务器默认配置
 */
const DEFAULT_CONFIG = {
    name: "DynamicApiServer",
    version: "1.0.0",
    debug: false
};
/**
 * MCP服务器类 - 提供API元工具和交互能力
 */
class ApiServer {
    constructor(config = {}) {
        this.isRunning = false;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.server = new mcp_js_1.McpServer({
            name: this.config.name,
            version: this.config.version
        });
        this.transport = new stdio_js_1.StdioServerTransport();
    }
    /**
     * 初始化服务器，注册API元工具
     */
    initialize() {
        this.registerMetaTools();
    }
    /**
     * 启动服务器
     */
    async start() {
        if (this.isRunning) {
            this.logDebug("MCP服务器已经在运行中");
            return;
        }
        try {
            await this.server.connect(this.transport);
            this.isRunning = true;
            this.logDebug("MCP服务器已启动");
        }
        catch (error) {
            console.error("启动MCP服务器失败:", error);
            throw error;
        }
    }
    /**
     * 停止服务器
     * 注意: McpServer API没有提供disconnect方法
     * 这里我们只能记录服务器状态，无法真正断开连接
     */
    async stop() {
        if (!this.isRunning) {
            this.logDebug("MCP服务器已经停止");
            return;
        }
        try {
            // 由于McpServer没有断开连接的方法，我们只能标记状态
            // 实际上，当进程结束时，连接会自动关闭
            this.isRunning = false;
            this.logDebug("MCP服务器已标记为停止状态");
        }
        catch (error) {
            console.error("停止MCP服务器失败:", error);
        }
    }
    /**
     * 注册所有API元工具
     */
    registerMetaTools() {
        // 1. 基础元工具：获取所有可用API列表
        this.server.tool("listAllApis", "列出所有可用的API接口", {}, async () => {
            try {
                // 获取简化的API列表
                const apis = registry_1.default.getAllApiIds().map(id => {
                    const apiInfo = registry_1.default.getApiInfo(id);
                    return {
                        id,
                        name: apiInfo?.name || id,
                        description: apiInfo?.description || "",
                        category: apiInfo?.category || "未分类"
                    };
                });
                // 按分类组织成简洁的列表
                const groupedApis = {};
                // 先对apis进行分组
                apis.forEach(api => {
                    if (!groupedApis[api.category]) {
                        groupedApis[api.category] = [];
                    }
                    // 同时显示ID、名称和描述
                    groupedApis[api.category].push(`${api.id}-${api.name}-${api.description}`);
                });
                // 构建简洁的文本响应
                let response = "可用API列表(apiId-Name-Description):\n\n";
                for (const category of Object.keys(groupedApis)) {
                    response += `${category}:\n`;
                    groupedApis[category].forEach(apiText => {
                        response += `  • ${apiText}\n`;
                    });
                    response += "\n";
                }
                response += "可使用 getApiDetails 工具获取特定API的详细信息,其中source表示来源";
                return {
                    content: [{
                            type: "text",
                            text: response
                        }]
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                            type: "text",
                            text: `错误: 获取API列表失败 - ${errorMessage}`
                        }]
                };
            }
        });
        // 2. 基础元工具：获取特定API的详细信息
        this.server.tool("getApiDetails", "获取特定API的详细信息和使用方法", {
            apiId: zod_1.z.string().describe("API的唯一标识符")
        }, async ({ apiId }) => {
            try {
                const apiInfo = registry_1.default.getApiInfo(apiId);
                if (!apiInfo) {
                    return {
                        content: [{
                                type: "text",
                                text: `错误: 未找到ID为 ${apiId} 的API`
                            }]
                    };
                }
                return {
                    content: [{
                            type: "text",
                            text: `API详细信息:\n${JSON.stringify(apiInfo, null, 2)}`
                        }]
                };
            }
            catch (error) {
                return {
                    content: [{
                            type: "text",
                            text: `错误: 获取API详情失败 - ${error?.message || error}`
                        }]
                };
            }
        });
        // 3. 基础元工具：执行API
        this.server.tool("executeApi", "执行指定的API,需要提供API的ID和参数", {
            apiId: zod_1.z.string().describe("要执行的API的唯一标识符"),
            params: zod_1.z.record(zod_1.z.any()).optional().describe("API的参数")
        }, async ({ apiId, params = {} }) => {
            try {
                const result = await registry_1.default.executeApi(apiId, params);
                return {
                    content: [{ type: "text", text: result }]
                };
            }
            catch (error) {
                return {
                    content: [{
                            type: "text",
                            text: `错误: ${error?.message || error}`
                        }]
                };
            }
        });
        this.logDebug("已注册API元工具");
    }
    /**
     * 输出调试日志
     */
    logDebug(message) {
        if (this.config.debug) {
            console.log(`[Debug] ${message}`);
        }
    }
}
exports.ApiServer = ApiServer;
// 导出默认服务器实例
const defaultServer = new ApiServer();
exports.default = defaultServer;
