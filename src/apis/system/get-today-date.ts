import { ApiCategories } from "../../config/api-config";

/**
 * 获取本地当前日期（不依赖外部服务）
 */
export default {
  id: "getTodayDate",
  name: "获取今天日期",
  description: "返回今天的日期，格式为 yyyy-MM-dd（本地时区）",
  category: ApiCategories.SYSTEM,
  schema: {},
  handler: async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const formattedMonth = month < 10 ? `0${month}` : `${month}`;
    const formattedDay = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
    return JSON.stringify({ date: dateStr }, null, 2);
  },
  examples: [
    {
      description: "获取今天日期",
      params: {},
    },
  ],
};
