import { z } from "zod";
import { ApiCategories } from "../../config/api-config";
import { fetchData, handleLargeResponse } from "../../utils/http-utils";
import { processResponse } from "../../utils/apiResponseProcessor";
import { AUTH_COOKIE, BASE_API_URL } from "../../config/api-config";

/**
 * 根据ID获取公司详情API
 */
export default {
  id: "getOrganizeInfo",
  name: "获取机构(单位)详情",
  description: "通过机构(单位)ID获取公司的详细信息(联系人,地址等)",
  category: ApiCategories.ORGANIZE,
  schema: {
    id: z.string().describe("机构(单位)ID").source("调用getOrganize工具获取id")
  },
  handler: async ({ id }: { id: string }) => {
    try {
      const url = `${BASE_API_URL}/Organize/getInfo/${id}`;
      const rawResponse = await fetchData(url, 'GET', null, {'Cookie': AUTH_COOKIE});
      const processedResponse = processResponse(rawResponse);
      
      return `${handleLargeResponse(processedResponse)}`;
    } catch (error) {
      return `错误: 获取公司详情失败 - ${error}`;
    }
  },
  examples: [
    {
      description: "天津天元海的信息有哪些",
      params: {
        id: "316208DD-1D52-11EA-B720-0894EF2B0723"
      }
    }
  ]
}; 