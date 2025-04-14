import { ApiCategories } from "../../config/api-config";
import { handleLargeResponse } from "../../utils/http-utils";
import { loadDictionary } from "../../utils/dictionary-utils";
import { processResponse } from "../../utils/apiResponseProcessor";

/**
 * 获取所有字典API
 */
export default {
  id: "getAllDictionaries",
  name: "获取所有字典",
  description: "通常用于其他工具调用结果里返回字段里有代号时，需要转换为中文",
  category: ApiCategories.COMMON,
  schema: {},
  handler: async () => {
    try {
      const dictionary = loadDictionary();
      const processedResponse = processResponse(dictionary);
      return `${handleLargeResponse(processedResponse)}`;
    } catch (error) {
      return `错误: 获取字典失败 - ${error}`;
    }
  },
  examples: [
    {
      description: "获取所有字典数据",
      params: {}
    }
  ]
}; 