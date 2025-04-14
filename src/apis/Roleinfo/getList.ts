import { ApiCategories } from "../../config/api-config";
import { z } from "zod";
import { fetchData, handleLargeResponse } from "../../utils/http-utils";
import { processResponse } from "../../utils/apiResponseProcessor";
import { AUTH_COOKIE, BASE_API_URL, DEFAULT_PAGINATION } from "../../config/api-config";

// 角色信息查询参数接口
interface RoleInfoListParams {
  ifPage?: boolean;
  currentPage?: number;
  pageRecord?: number;
}

/**
 * 获取角色信息列表API
 * 此API用于查询角色信息列表，支持分页
 */
export default {
  id: "getRoleList",
  name: "获取角色信息列表",
  description: "查询角色信息列表，包含所属公司等",
  category: ApiCategories.ROLEINFO,
  schema: {
    ifPage: z.boolean().optional().describe("是否分页").default(true),
    currentPage: z.number().optional().describe("当前页码").default(DEFAULT_PAGINATION.CURRENT_PAGE),
    pageRecord: z.number().optional().describe("每页记录数").default(DEFAULT_PAGINATION.PAGE_SIZE),
  },
  handler: async ({
    ifPage,
    currentPage,
    pageRecord,
  }: RoleInfoListParams) => {
    try {
      const body = {
        ifPage,
        currentPage,
        pageRecord,
      };

      const url = `${BASE_API_URL}/Roleinfo/getList`;
      const rawResponse = await fetchData(url, 'POST', body, {'Cookie': AUTH_COOKIE});
      const processedResponse = processResponse(rawResponse);
      
      return `${handleLargeResponse(processedResponse)}`;
    } catch (error) {
      const err = error as Error;
      return `错误: 获取角色信息列表失败 - ${err.message}`;
    }
  },
  examples: [
    {
      description: "获取角色信息列表（分页）",
      params: {
        currentPage: 1,
        pageRecord: 15,
        ifPage: true
      }
    }
  ]
}; 