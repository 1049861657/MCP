import { z } from "zod";
import { ApiCategories } from "../../config/api-config";
import { fetchDataAuth, handleLargeResponse } from "../../utils/http-utils";
import { processResponse } from "../../utils/apiResponseProcessor";
import { BASE_API_URL } from "../../config/api-config";

/**
 * 获取设备运行参数API
 */
export default {
  id: "getParameter",
  name: "获取设备运行参数",
  description: "利用参数编号查询设备的运行参数信息",
  category: ApiCategories.BEACON,
  schema: {
    parameterId: z.string().describe("参数编号").source("getTaskrecordList最新一条记录的parameterId")
  },
  handler: async ({ parameterId }: { parameterId: string }) => {
    try {
      const url = `${BASE_API_URL}/Statuslist/getParameter/${parameterId}`;
      const rawResponse = await fetchDataAuth(url, 'GET', null);
      const processedResponse = processResponse(rawResponse);
      
      return `${handleLargeResponse(processedResponse)}`;
    } catch (error) {
      return `错误: 获取设备运行参数失败 - ${error}`;
    }
  },
  examples: [
    {
      description: "获取该参数编号对应的运行参数",
      params: {
        parameterId: "9dc646c437d948e1a591d15b6ad049c0"
      }
    }
  ]
}; 