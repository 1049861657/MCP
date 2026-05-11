# 动态 API 服务器

一个基于 MCP 协议的模块化动态 API 服务器，为 AI 助手提供丰富的工具能力，同时显著减少 prompt token 消耗。

## 特点

- **元工具设计**：AI 仅需知道三个元工具（`listAllApis` / `getApiDetails` / `executeApi`），而非全部 API
- **模块化 API**：每个 API 是独立文件，易于维护和扩展，服务启动后热加载
- **子 agent 支持**：API handler 内可内嵌子 agent，透明代理外部 MCP 或复杂多步任务，无需客户端接入多个 MCP
- **实时进度通知**：通过标准 MCP `notifications/progress` 将子 agent 的每步进度实时推送给客户端
- **类型安全**：完整 TypeScript 类型定义，Zod 参数校验

## 工作原理

### 元工具模式

通过元工具设计模式，将所有具体 API 实现从 prompt 中剥离，仅保留三个核心元工具：

1. **`listAllApis`**：列出所有可用 API，按分类分组
2. **`getApiDetails`**：获取特定 API 的参数说明、示例及能力声明
3. **`executeApi`**：执行指定 API，接收 `apiId` 和 `params`

### 子 agent 模式

当某个业务 API 需要调用外部 MCP 服务（如第三方知识库、数据平台等），不必在客户端再接入一个 MCP，而是在服务端将其封装为**子 agent**：

```
客户端 → executeApi("someApi")
              ↓
         子 agent（服务端内部）
              ↓ ReAct 循环
         外部 MCP 工具调用 × N 步
              ↓
         汇总结果返回客户端
```

子 agent 的每步执行通过 `notifications/progress` 实时推送给客户端，过程不再黑盒。客户端在调用时携带 `progressToken`，即可实时感知子 agent 的执行步骤。

`getApiDetails` 返回的 `supportsProgress: true` 字段标识该 API 内部使用了子 agent，客户端据此决定是否携带 `progressToken`。

## 目录结构

```
/src
  /agents                 # 子 agent 基础设施
    llm-provider.ts       # LLM Provider（OpenAI 协议兼容）
    kb-mcp-client.ts      # 示例：知识库 MCP 客户端（stdio 单例）
    kb-sub-agent.ts       # 示例：知识库 ReAct 子 agent
  /apis                   # 业务 API（按分类子目录）
  /config
    api-config.ts         # API 分类等全局配置
  /core
    registry.ts           # API 注册中心
    loader.ts             # 动态加载机制
    server.ts             # MCP Streamable HTTP 服务器
  index.ts                # 入口文件
```

## 快速启动

```bash
# 构建并启动
npm run start

# 仅构建
npm run build
```

## 环境变量

### 服务器

| 变量 | 说明 | 默认值 |
|---|---|---|
| `MCP_HOST` | 监听地址 | `127.0.0.1` |
| `MCP_PORT` | 监听端口 | `8080` |

### 子 agent LLM

| 变量 | 必填 | 说明 | 默认值 |
|---|---|---|---|
| `LLM_API_KEY` | ✅ | LLM API Key | — |
| `LLM_BASE_URL` | 否 | 兼容 OpenAI 协议的接口地址 | `https://api.openai.com/v1` |
| `LLM_MODEL` | 否 | 模型名称（需支持 function calling） | `gpt-4o-mini` |

### 子 agent 调试调优

| 变量 | 说明 | 默认值 |
|---|---|---|
| `KB_STEP_TIMEOUT_MS` | 子 agent 每步 LLM 调用超时（毫秒），完成一步后重置 | `60000` |
| `KB_DEBUG` | 设为 `1` 开启服务端每步执行日志 | 关闭 |
| `KB_VERBOSE` | 设为 `1` 在响应中包含详细 trace | 关闭 |

## 添加新 API

在 `src/apis/<分类>/` 下创建文件，导出符合 `ApiDefinition` 接口的对象：

```typescript
import { z } from "zod";
import { ApiCategories } from "../../config/api-config";

export default {
  id: "yourApiId",
  name: "你的 API 名称",
  description: "API 功能描述",
  category: ApiCategories.COMMON,
  // 若 handler 内部使用了子 agent 并会推送进度通知，声明此字段
  // supportsProgress: true,
  schema: {
    param1: z.string().describe("参数说明"),
    param2: z.number().optional().describe("可选参数"),
  },
  handler: async ({ param1, param2 = 0 }, context) => {
    // context.onProgress 可用于推送进度通知
    return JSON.stringify({ result: `${param1}, ${param2}` });
  },
  examples: [
    { description: "示例", params: { param1: "test" } }
  ],
};
```

保存后服务器自动热加载，无需重启。

## 维护

- **新增分类**：在 `src/config/api-config.ts` 的 `ApiCategories` 中添加
- **新增子 agent**：参考 `src/agents/` 下的实现，实现 LLM + 外部 MCP 的 ReAct 循环
- **修改元工具行为**：调整 `src/core/server.ts` 中的 `registerMetaToolsOn`

## 许可证

MIT
