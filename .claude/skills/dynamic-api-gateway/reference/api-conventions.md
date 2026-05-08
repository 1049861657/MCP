# API 命名与参数约定

> Loaded on-demand. 仅当需要新增 API、解释命名差异、或排查参数来源不明时阅读。

## 目录结构

```text
src/apis/
├── <分类目录>/         # 如 system/、examples/、Organize/、Statuslist/
│   ├── <api-name>.ts   # 一个文件一个 API（推荐）
│   └── ...
```

- 分类目录名 = `category` 字段语义来源（loader 自动注入到注册日志的 `__moduleDirectory`）
- 文件名建议 kebab-case（`get-today-date.ts`）
- `apiId` 建议 camelCase（`getTodayDate`）

## ApiDefinition 字段

```ts
{
  id: string,            // 全局唯一；建议动词 + 实体（getXxxList / addXxx / updateXxx）
  name: string,          // 中文显示名，简短
  description: string,   // 一句话；超过 80 字会被 listAllApis 自动截断
  category: ApiCategory, // 见 src/config/api-config.ts
  schema: Record<string, ZodSchema>,
  handler: (params) => Promise<string>,   // 必须返回 string（通常 JSON.stringify 结果）
  examples?: { description, params }[]    // 至少 1 个；listAllApis 后被截断为首条
}
```

## 命名动词约定（影响只读/写入判定）

| 前缀 | 语义 | Skill 行为 |
|---|---|---|
| `get*` / `list*` / `query*` / `search*` | 只读查询 | 可自动调用 |
| `add*` / `create*` / `import*` | 新增 | 需先与用户确认 |
| `update*` / `set*` / `modify*` | 修改 | 需先与用户确认 |
| `delete*` / `remove*` / `reset*` | 删除/复位 | 强制与用户确认，并复述影响范围 |

## 参数 source 字段

`schema` 中可在 zod 上挂 `source` meta（通过 `z.globalRegistry`），常见取值：

| source | 含义 | 取参流程 |
|---|---|---|
| `dictionary:<key>` | 来自字典表的某个 key | 先调字典 API 获取候选值 |
| `enum:<key>` | 枚举码 | 同上 |
| `api:<apiId>.<field>` | 来自另一个 API 返回值的某字段 | 先调 `<apiId>`，从结果里取 `<field>` |
| `user` | 由用户直接给出 | 直接询问用户 |
| `context` | 来自当前会话上下文（如登录态） | 不要询问用户，使用上下文值 |

> 看到 `source` 字段时**优先按 source 取值**，不要直接问用户。

## 默认值与可选

- `parameters[].required = false` 表示可选；`default` 给出默认值时直接采用，无需询问
- 可选 + 可空（`Type|null?`）的字段允许显式传 `null` 表示"清空"

## 分类约定

- `示例`：实验/连通性测试，**生产场景不要主动调用**
- `系统工具`：通用工具（日期、回显等），可任意调用
- 业务分类（`组织`、`设备状态` 等）：必须先 `getApiDetails` 确认参数来源

## 新增 API 检查清单

写新 API 时校对：

- [ ] `id` 全局唯一，动词前缀正确
- [ ] `description` ≤ 80 字（否则 listAllApis 会截断）
- [ ] 必填参数都加了 `.describe()`
- [ ] 来自字典/枚举/其他 API 的参数挂上了 `source` meta
- [ ] 至少 1 个 `examples`，覆盖最常见调用形态
- [ ] handler 抛错时给出可读的中文消息（会被前端展示）
