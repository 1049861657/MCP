# 工作流配方

> Loaded on-demand. 当用户请求涉及多步、跨分类、批量、对账等复杂场景时阅读。

## Recipe 1：单意图三步走（最常见）

适用：用户问"X 是什么 / 查一下 X / 帮我 X"，能由单个 API 满足。

```
1. listAllApis()                          # 浏览 catalog
2. getApiDetails(<选中的apiId>)           # 看 requiredParams
3. executeApi(<apiId>, <补齐的 params>)   # 输出摘要给用户
```

**省 token 提示**：若会话中已经调过同一 apiId 的 `getApiDetails`，第二次起可跳过第 2 步直接执行（除非参数 source 涉及外部状态可能变化）。

## Recipe 2：跨分类级联查询

适用：用户问"组织 X 下的设备状态"、"用户 Y 最近的任务记录"。

```
A. listAllApis()                          # 找出 2~3 个候选 apiId（不同 category）
B. 串行 getApiDetails 每一个              # 关注 source = "api:<other>.<field>" 的级联关系
C. 按依赖顺序执行：
   r1 = executeApi(<根apiId>, <用户给的入参>)
   把 r1 中下游需要的字段 (例如 r1.deptId) 作为下游 params
   r2 = executeApi(<下游apiId>, { deptId: r1.deptId, ...其他 })
D. 汇总：合并 r1 + r2 的字段为一个结构化响应；标注每段来自哪个 apiId
```

**陷阱**：
- 上下游字段名可能不一致（如上游叫 `id`、下游叫 `orgId`）— 必须查 `getApiDetails` 而不是猜
- 上游返回数组时，下游一般要循环执行 — 用户没说"全量"就先取 top N 询问

## Recipe 3：批量调用同一 apiId

适用：用户提供一组实体 ID，要求逐个查询/操作。

```
1. getApiDetails(<apiId>)                 # 确认入参 shape
2. 串行执行（默认不并行）：
   results = []
   failures = []
   for each input in batch:
     try: results.push(await executeApi(apiId, buildParams(input)))
     catch e: failures.push({ input, error: e })
3. 汇报：成功 N 条 / 失败 M 条；失败示例展示前 3 条；询问是否对失败项做兜底
```

**为什么默认串行**：减少对后端的瞬时压力 + 节省单条响应内 token（每条独立摘要）。仅在用户明确说"并行"时才并发。

## Recipe 4：字典/枚举驱动的查询

适用：用户用业务名称（"在线"、"维修中"）描述状态，但 API 需要状态码（"01"、"03"）。

```
1. listAllApis()                          # 找字典/枚举类 API（通常在"系统"/"通用"分类）
2. executeApi(<dict apiId>, { key: "deviceStatus" })
3. 在字典结果里把"在线"映射为 "01"
4. 用映射后的值调用真正的查询 API
```

**陷阱**：字典是会变的——不要把映射结果硬编码或缓存到下一轮会话。

## Recipe 5：对账/差异比较

适用："对比这两个组织的设备数量"、"上周和本周的任务对比"。

```
1. listAllApis() → 找到对应"统计/汇总"类 API
2. getApiDetails 一次（两次调用同 schema）
3. executeApi 两次，分别传两个时间段/对象的入参
4. 在响应里仅给：差异维度 + 数值差 + 同/比变化率，不要把两份原数据全 dump
```

## Recipe 6：分页拉取

如果某个 API 返回 `pageNo` / `pageSize` / `total`：

```
1. 首次：executeApi(apiId, { pageNo: 1, pageSize: 20 })
2. 看 total - 若 total > 20 → 询问用户"继续看下一页吗"或汇总告知共 N 页
3. 不要默认把所有页拉完——很容易爆 token
```

## Recipe 7：调用内嵌子 Agent 的长耗时 API

适用：某个 API 的 `description` 或 `getApiDetails` 表明其内部会运行多步推理/检索（如问答、分析、聚合等），执行时间预期较长。

```
1. getApiDetails(<apiId>)
   - 确认必填参数，尤其是"问题/目标"类输入
2. executeApi(<apiId>, params)
   - 服务端子 agent 在内部自主完成多步工具调用，最终一次性返回结果
   - 客户端基础设施已自动处理进度通知，无需额外操作
3. 响应通常包含以下字段（具体由 API 定义）：
   - answer / result：主要结果，直接呈给用户
   - finishReason：执行结束原因（若存在）
   - trace / steps：可观测信息，摘要即可，不要全 dump
4. 处置 finishReason（若 API 返回此字段）：
   - answered / success  → 直接采用结果
   - max_steps           → 可拆分问题后分别查询
   - timeout             → 缩小范围后重试
   - loop_guard          → 换关键词或提问方式重试一次
   - error               → 展示 error 原文；含网络/连接关键词时等片刻后重试一次
5. 触发 nextHint 时按其建议执行；连续两次失败即停下问用户
```

**注意**：
- 子 agent 已在服务端做"内层多轮"，**外层不要就同一输入反复调用**
- 同一会话中已得到结果的查询，直接复用上下文，不要重复发起

## 跨配方通用守则

- 每完成一个 recipe 步骤，**先回看 nextHint**，再决定下一步
- 一次会话中相同 apiId 的 `getApiDetails` 可缓存复用，不必反复调用
- 用户提到"快"/"立即" → 跳过非必要的 listAllApis（如果已知 apiId）
- 用户提到"安全"/"先看看" → 即使是只读 API 也先复述执行计划再调用
