import { z } from "zod";
import { ApiCategories } from "../../config/api-config";
import { fetchData, handleLargeResponse } from "../../utils/http-utils";
import { processResponse } from "../../utils/apiResponseProcessor";
import { AUTH_COOKIE, BASE_API_URL } from "../../config/api-config";

/**
 * 获取设备信息API
 */
export default {
  id: "getDeviceInfo",
  name: "获取单个设备的最新状态",
  description: "利用设备编号去查询单个设备详细信息",
  category: ApiCategories.BEACON,
  schema: {
    deviceCode: z.string().describe("设备编号").source("已知卡号->调用数据库工具[SELECT deviceCode FROM tbl_statuslist WHERE cardNumber = '通信卡号';]")
  },
  handler: async ({ deviceCode }: { deviceCode: string }) => {
    try {
      const url = `${BASE_API_URL}/Statuslist/getInfo/${deviceCode}`;
      const rawResponse = await fetchData(url, 'GET', null, {'Cookie': AUTH_COOKIE});
      const processedResponse = processResponse(rawResponse);
      
      return `${handleLargeResponse(processedResponse)}`;
    } catch (error) {
      return `错误: 获取设备信息失败 - ${error}`;
    }
  },
  examples: [
    {
      description: "获取指定设备的信息",
      params: {
        deviceCode: "SL0001"
      }
    }
  ]
}; 