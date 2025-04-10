import { ApiCategories } from "../../config/api-config";
import { z } from "zod";
import { fetchData, handleLargeResponse } from "../../utils/http-utils";
import { processResponse } from "../../utils/apiResponseProcessor";
import { AUTH_COOKIE, BASE_API_URL, DEFAULT_PAGINATION } from "../../config/api-config";

// 用户信息查询参数接口
interface UserInfoListParams {
  ifPage?: boolean;
  currentPage?: number;
  pageRecord?: number;
  username?: string;
  orgId?: string;
  phone?: string;
  ifAll?: number;
}

/**
 * 获取用户信息列表API
 * 此API用于查询用户信息列表，支持分页和条件筛选
 */
export default {
  id: "getUserList",
  name: "获取用户信息列表",
  description: "查询用户信息列表,支持按用户名、组织机构ID等条件筛选",
  category: ApiCategories.USERINFO,
  schema: {
    ifPage: z.boolean().describe("是否分页").default(true),
    currentPage: z.number().optional().describe("当前页码").default(DEFAULT_PAGINATION.CURRENT_PAGE),
    pageRecord: z.number().optional().describe("每页记录数").default(DEFAULT_PAGINATION.PAGE_SIZE),
    username: z.string().optional().describe("用户名"),
    orgId: z.string().optional().describe("所属单位或组织的ID").source("调用getOrganize工具获取id"),
    phone: z.string().optional().describe("电话号码"),
    ifAll: z.number().optional().describe("是否包含下属公司(0:不包含,1:包含)").default(1)
  },
  handler: async ({
    ifPage,
    currentPage,
    pageRecord,
    username,
    orgId,
    phone,
    ifAll
  }: UserInfoListParams) => {
    try {
      const body = {
        ifPage,
        currentPage,
        pageRecord,
        username,
        orgId,
        phone,
        ifAll
      };

      const url = `${BASE_API_URL}/Userinfo/getList`;
      const rawResponse = await fetchData(url, 'POST', body, {'Cookie': AUTH_COOKIE});
      const processedResponse = processResponse(rawResponse);
      
      return `获取用户信息列表结果:\n${handleLargeResponse(processedResponse, "用户信息列表")}`;
    } catch (error) {
      const err = error as Error;
      return `错误: 获取用户信息列表失败 - ${err.message}`;
    }
  },
  examples: [
    {
      description: "按组织机构ID查询",
      params: {
        orgId: "a2b472a2bfc94711abc99b4cbc308caf",
        ifPage: true,
        currentPage: 1,
        pageRecord: 15
      }
    }
  ]
}; 