import { ApiCategories } from "../../config/api-config";
import { processResponse } from "../../utils/apiResponseProcessor";
import { handleLargeResponse } from "../../utils/http-utils";

/**
 * 获取今天日期的API
 */
export default {
  id: "getTodayDate",
  name: "获取今天日期",
  description: "返回今天的日期,格式为yyyy-MM-dd",
  category: ApiCategories.SYSTEM,
  schema: {},
  handler: async () => {
    const today = new Date();
    
    // 获取年、月、日
    const year = today.getFullYear();
    // 月份从0开始，需要+1
    const month = today.getMonth() + 1;
    const day = today.getDate();
    
    // 格式化月和日（补0）
    const formattedMonth = month < 10 ? `0${month}` : `${month}`;
    const formattedDay = day < 10 ? `0${day}` : `${day}`;
    
    // 返回格式化的日期
    const processedResponse = processResponse(`${year}-${formattedMonth}-${formattedDay}`);
    return `${handleLargeResponse(processedResponse)}`;
  },
  examples: [
    {
      description: "获取今天日期",
      params: {}
    }
  ]
}; 