import { ApiCategories } from "../../config/api-config";
import { z } from "zod";
import { fetchDataAuth, handleLargeResponse } from "../../utils/http-utils";
import { processResponse } from "../../utils/apiResponseProcessor";
import { BASE_API_URL, DEFAULT_PAGINATION } from "../../config/api-config";

// 灯质信息查询参数接口
interface LightQualityListParams {
  ifPage?: boolean;
  currentPage?: number;
  pageRecord?: number;
  lightQualityName?: string;
  ifUsed?: string;
}

/**
 * 获取灯质信息列表API
 * 此API用于查询灯质信息列表，支持分页和名称筛选
 */
export default {
  id: "getLightQualityList",
  name: "获取灯质信息列表",
  description: "查询灯质信息列表，支持分页筛选",
  category: ApiCategories.LIGHTQUALITY,
  schema: {
    ifPage: z.boolean().optional().describe("是否分页").default(true),
    currentPage: z.number().optional().describe("当前页码").default(DEFAULT_PAGINATION.CURRENT_PAGE),
    pageRecord: z.number().optional().describe("每页记录数").default(DEFAULT_PAGINATION.PAGE_SIZE),
    lightQualityName: z.string().optional().describe("灯质名称"),
    ifUsed: z.string().optional().describe("是否常用(0:否,1:是)")
  },
  handler: async ({
    ifPage,
    currentPage,
    pageRecord,
    lightQualityName,
    ifUsed
  }: LightQualityListParams) => {
    try {
      const body = {
        ifPage,
        currentPage,
        pageRecord,
        lightQualityName,
        ifUsed
      };

      const url = `${BASE_API_URL}/Lightquality/getList`;
      const rawResponse = await fetchDataAuth(url, 'POST', body);
      const processedResponse = processResponse(rawResponse);
      
      return `${handleLargeResponse(processedResponse)}`;
    } catch (error) {
      const err = error as Error;
      return `错误: 获取灯质信息列表失败 - ${err.message}`;
    }
  },
  examples: [
    {
      description: "按名称筛选灯质列表",
      params: {
        currentPage: 1,
        pageRecord: 15,
        ifPage: true,
        lightQualityName: "闪(2)4秒"
      }
    }
  ]
}; 