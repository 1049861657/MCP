import { ApiCategories } from "../../config/api-config";
import { z } from "zod";
import { fetchData, handleLargeResponse } from "../../utils/http-utils";
import { processResponse } from "../../utils/apiResponseProcessor";
import { AUTH_COOKIE, BASE_API_URL, DEFAULT_PAGINATION } from "../../config/api-config";

// 设备分配查询参数接口
interface DeviceAllocationListParams {
  ifPage?: boolean;
  currentPage?: number;
  pageRecord?: number;
  type?: string;
}

/**
 * 获取设备分配列表API
 * 此API用于查询设备分配信息列表，支持分页和类型筛选
 */
export default {
  id: "getDeviceList",
  name: "获取设备分配列表",
  description: "查询设备分配状态列表",
  category: ApiCategories.DEVICEALLOCATION,
  schema: {
    ifPage: z.boolean().optional().describe("是否分页").default(true),
    currentPage: z.number().optional().describe("当前页码").default(DEFAULT_PAGINATION.CURRENT_PAGE),
    pageRecord: z.number().optional().describe("每页记录数").default(DEFAULT_PAGINATION.PAGE_SIZE),
    type: z.string().optional().describe("是否已分配(0:否,1:是)")
  },
  handler: async ({
    ifPage,
    currentPage,
    pageRecord,
    type
  }: DeviceAllocationListParams) => {
    try {
      const body = {
        ifPage,
        currentPage,
        pageRecord,
        type
      };

      const url = `${BASE_API_URL}/Beidoucard/getDeviceList`;
      const rawResponse = await fetchData(url, 'POST', body, {'Cookie': AUTH_COOKIE});
      const processedResponse = processResponse(rawResponse);
      
      return `获取设备分配列表结果:\n${handleLargeResponse(processedResponse, "设备分配列表")}`;
    } catch (error) {
      const err = error as Error;
      return `错误: 获取设备分配列表失败 - ${err.message}`;
    }
  },
  examples: [
    {
      description: "获取已分配设备列表",
      params: {
        currentPage: 1,
        pageRecord: 15,
        ifPage: true,
        type: "1"
      }
    }
  ]
}; 