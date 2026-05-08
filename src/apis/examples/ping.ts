import { ApiCategories } from "../../config/api-config";
import { z } from "zod";

/**
 * 最小示例 API：验证动态加载与 executeApi 流程
 */
export default {
  id: "ping",
  name: "Ping",
  description: "回显消息，用于连通性检查",
  category: ApiCategories.EXAMPLES,
  schema: {
    message: z.string().optional().describe("可选，默认 ping"),
  },
  handler: async ({ message = "ping" }: { message?: string }) => {
    return JSON.stringify({ ok: true, echo: message }, null, 2);
  },
  examples: [
    {
      description: "默认",
      params: {},
    },
    {
      description: "自定义消息",
      params: { message: "hello" },
    },
  ],
};
