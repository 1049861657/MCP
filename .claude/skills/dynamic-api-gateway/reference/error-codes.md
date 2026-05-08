# 错误码与恢复动作

> Loaded on-demand. 优先看每次响应的 `nextHint`，仅当 `nextHint` 无效或缺失时再翻本表。

## 元工具响应错误结构

所有错误都遵循统一形态：

```json
{
  "error": "<可读消息>",
  "missingParams": ["..."],   // 仅 executeApi 缺参时存在
  "candidates": ["..."],      // 仅 getApiDetails 找不到 apiId 时存在
  "nextHint": "<下一步建议>"
}
```

## 常见错误与处置

### 1. `getApiDetails` — `未找到ID为 X 的API`

- **原因**：apiId 拼写错误，或 API 还未注册
- **响应附带**：`candidates`（模糊匹配的最多 5 个候选）
- **处置**：
  1. 若 `candidates` 非空 → 选最接近的复用，再次调用 `getApiDetails`
  2. 若 `candidates` 为空 → 调 `listAllApis` 浏览 catalog 寻找；仍找不到则告知用户"该能力暂未提供"

### 2. `executeApi` — `缺少必需参数: a, b`

- **响应附带**：`missingParams: ["a", "b"]`，`nextHint` 指引去取详
- **处置**：
  1. 调 `getApiDetails(apiId)` 取每个缺参的 `parameters[].source`
  2. 按 source 类型获取（见 `api-conventions.md` 的 source 表）
  3. 仍无法获得 → 询问用户

### 3. `executeApi` — `执行API 'X' 失败: <handler 抛错>`

- **原因**：handler 内部异常（数据库连不上、上游 API 报错、参数类型不对等）
- **处置**：
  1. 检查参数类型与 `requiredParams` 是否匹配
  2. 同样的 apiId + 同样的 params 重试 1 次（可能是瞬时网络）
  3. 仍失败 → 把 `error` 字段原文展示给用户，**不要伪造修复**

### 4. `listAllApis` — `total: 0`

- **原因**：服务刚启动 API 还没加载完 / API 加载失败
- **处置**：等 1 秒重试一次；仍 0 则告知用户"API 注册表为空"

### 5. zod 校验失败（参数类型不匹配）

- 表现：错误消息含 `Invalid input` 或类似 zod 文案
- 处置：查 `getApiDetails` 的 `parameters[].type`：
  - `string?` 表示可选字符串
  - `string|null` 表示可空
  - `string[]` 表示数组（不要传单值）
  - `object` / `record` 表示嵌套结构（看 examples）

## 不应自愈的错误

以下情况**直接告诉用户并停下**，不要重试或猜测：

- 错误消息出现 `forbidden` / `unauthorized` / `permission` 字样
- 同一 apiId + 同一 params 已经连续失败 2 次
- 错误指向数据已经被改写（如 `duplicate key`）— 重试会引发副作用

## 调试线索字段

| 字段 | 来源 | 用途 |
|---|---|---|
| `nextHint` | 元工具响应 | 首要恢复指引 |
| `missingParams` | executeApi 缺参 | 直接喂给 `getApiDetails` |
| `candidates` | getApiDetails 未命中 | 模糊匹配候选 |
| `requiredParams` | getApiDetails 成功响应 | 后续 executeApi 必备 |
