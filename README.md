# 动态API服务器

一个基于MCP协议的模块化动态API服务器，为AI助手提供丰富的工具能力，同时显著减少prompt token消耗。

## 特点

- **模块化API设计**：每个API都是独立模块，易于维护和扩展
- **动态发现与加载**：自动扫描和加载API目录中的模块
- **元工具设计**：AI仅需知道三个元工具，而不是全部API
- **热更新支持**：监控API文件变化，无需重启即可更新
- **类型安全**：完整的TypeScript类型定义
- **丰富的文档**：每个API都包含详细说明和使用示例

## 工作原理

本项目解决了传统MCP工具实现中API数量增长导致prompt负担过重的问题。通过元工具设计模式，将所有具体API实现从prompt中剥离，仅保留三个核心元工具：

1. **listAllApis**：列出所有可用API，可按分类筛选
2. **getApiDetails**：获取特定API的详细信息和使用方法
3. **executeApi**：执行指定的API，接收API ID和参数

AI可以先探索可用API，获取详情，然后再执行，而不需要预先了解所有API的细节。

## 目录结构

```
/MCP
  /src                  # 源代码目录
    /core               # 核心模块
      registry.ts       # API注册中心
      loader.ts         # 动态加载机制
      server.ts         # MCP服务器核心
    /apis               # API模块目录
    /config             # 配置文件目录
      api-config.ts     # API全局配置
    /utils              # 实用工具库
    index.ts            # 入口文件
```

### 构建和运行

```bash
# 编译并启动
npm run start:dev
```

## 添加新API

创建新API非常简单，只需要在`src/apis`目录下的适当子目录中创建新文件：

```typescript
// src/apis/your-category/your-api.ts
import { z } from 'zod';
import { ApiCategories } from '../../core/registry';

export default {
  id: "yourApiId",
  name: "你的API名称",
  description: "API功能描述",
  category: ApiCategories.COMMON, // 选择适当的分类
  schema: {
    // 使用Zod定义参数
    param1: z.string().describe("参数1说明"),
    param2: z.number().optional().describe("可选参数2说明")
  },
  handler: async ({ param1, param2 = 0 }) => {
    try {
      // 实现API逻辑
      return `你的API结果: ${param1}, ${param2}`;
    } catch (error) {
      throw new Error(`执行失败: ${error.message}`);
    }
  },
  examples: [
    {
      description: "使用示例1",
      params: { param1: "示例值", param2: 42 }
    }
  ]
};
```

保存文件后，服务器会自动发现并加载新API，无需重启。

## 维护和扩展

- **添加新分类**：在`src/core/registry.ts`中的`ApiCategories`对象添加新分类
- **修改API行为**：直接编辑相应的API模块文件
- **修改加载行为**：调整`src/core/loader.ts`中的配置或行为

## 许可证

MIT 