---
name: dynamic-api-gateway
description: Discover and invoke business APIs through the dynamic MCP gateway. Use when the user asks to query devices, organizations, users, tasks, dictionaries, or any backend data exposed by this server. Follow the listAllApis → getApiDetails → executeApi discovery flow; well-known self-descriptive APIs (e.g. askKnowledgeBase) may be called directly.
when_to_use: Triggered for backend data queries, status checks, organizational lookups, dictionary/enum decoding, batch operations, or whenever the user references API IDs returned by this gateway.
allowed-tools: mcp__listAllApis mcp__getApiDetails mcp__executeApi
---

# Dynamic API Gateway

This MCP server exposes **three meta tools** that proxy a registry of business APIs. Never assume an apiId exists — always discover first.

## 调用规约（常驻规则）

1. **发现** — 不确定时调用 `listAllApis`。返回的 `catalog` 按业务分类分组；按关键词在 `id` / `name` / `description` 中匹配。
2. **取详** — 拿到候选 `apiId` 后调用 `getApiDetails(apiId)`。重点关注：
   - `requiredParams`：必填参数列表
   - `parameters[].source`：参数取值来源（如来自其他 API、字典、枚举）
   - `examples[0]`：典型调用样例
3. **执行** — 通过 `executeApi(apiId, params)` 调用。**缺参不要瞎填**——先回头取详或问用户。
4. **错误自愈** — 任何元工具返回 `nextHint` 字段时，**优先按其指引继续**；只有 `nextHint` 也无解时才打断用户。

## 反模式（不要做）

- ❌ 跳过 `getApiDetails` 直接 `executeApi`，除非已经在本次会话中取过同一 apiId 的详情
- ❌ 把上一次 `executeApi` 的返回字段名直接当作下一次的入参名 — 字段命名可能不同，先核对
- ❌ 并行批量调用同一 apiId 的多个不同参数（除非用户明确要求批量；批量请用 `/batch-execute` prompt）
- ❌ 在用户未授权下调用动词为 `add` / `update` / `delete` / `import` / `reset` 等可能改写状态的 API
- ❌ 把整段 `listAllApis` 的 catalog 复述给用户 — 只挑选相关项

## 性能与 token 守则

- `listAllApis` 是**便宜的**（已做长描述截断 + 排序），可在不确定时随时调用
- `getApiDetails` 默认只返回首条 example；**够用即可**，不必索取更多 examples
- `executeApi` 的返回值通常是 JSON 字符串，**逐字传递给用户前先摘要**——不要把大数组完整 dump

## 何时启用本 skill

任何时候用户的请求**可能由本 MCP 已注册的 API 满足**，例如（非穷举）：

| 场景 | 典型动作 |
|---|---|
| 通用业务查询 | 先 `listAllApis`，再依次取详执行 |
| 跨实体级联（如"组织下的设备"） | `listAllApis` 找多个候选，`getApiDetails` 确认级联字段，按依赖顺序执行 |
| 参数含 `source` 字段 | 按 `source` 指示先取字典/枚举/上游 API，不要直接问用户 |
| 高频且 apiId 自描述的 API | 可跳过 `listAllApis`，直接 `getApiDetails` → `executeApi` |

## 详细参考（按需加载）

仅在以下情形读取对应文件，不要预先全部加载：

- 写代码或解释 API 命名/参数约定 → `reference/api-conventions.md`
- 遇到 nextHint 不能解决的错误 → `reference/error-codes.md`
- 多步组合查询、对账、级联调用 → `reference/workflow-recipes.md`

