import { z } from "zod";
import { ApiCategories } from "../../config/api-config";
import { fetchDataAuth, handleLargeResponse } from "../../utils/http-utils";
import { processResponse } from "../../utils/apiResponseProcessor";
import { BASE_API_URL, DEFAULT_PAGINATION } from "../../config/api-config";

// 状态列表参数接口
interface StatusListParams {
  ifPage?: boolean;
  currentPage?: number;
  pageRecord?: number;
  keyword?: string;
  selectCmpId?: string;
  commModeCodeList?: string[];
  alarmList?: string[];
}

/**
 * 获取设备状态列表API
 */
export default {
  id: "getStatusList",
  name: "获取多个设备(灯器)的最新数据状态",
  description: "支持分页、关键词搜索(航标名称(北塘13)、设备编号(01030303210034)或通信卡号(992605))和按单位过滤，可查询多种报警和通信方式",
  category: ApiCategories.BEACON,
  schema: {
    ifPage: z.boolean().describe("是否分页").default(true),
    currentPage: z.number().optional().describe("当前页码").default(DEFAULT_PAGINATION.CURRENT_PAGE),
    pageRecord: z.number().optional().describe("每页记录数").default(DEFAULT_PAGINATION.PAGE_SIZE),
    keyword: z.string().optional().describe("关键词(航标名称、设备编号或通信卡号)。禁止填入单位名(比如上海港航中心)"),
    selectCmpId: z.string().optional().describe("所属单位或组织的ID").source("调用getOrganize工具获取id"),
    commModeCodeList: z.array(z.string()).optional().describe("通信方式代号").source("调用枚举工具[commModeCode]"),
    alarmList: z.array(z.string()).optional().describe("报警内容代号").source("调用枚举工具[alarmCodes]")
  },
  handler: async ({ 
    ifPage, 
    currentPage, 
    pageRecord, 
    keyword, 
    selectCmpId, 
    commModeCodeList, 
    alarmList 
  }: StatusListParams) => {
    try {
      const body = {
        ifPage,
        currentPage,
        pageRecord,
        keyword,
        selectCmpId,
        commModeCodeList,
        alarmList
      };
      const url = `${BASE_API_URL}/Statuslist/getList`;
      const rawResponse = await fetchDataAuth(url, 'POST', body);
      const processedResponse = processResponse(rawResponse);
      
      return `${handleLargeResponse(processedResponse)}`;
    } catch (error) {
      return `错误: 获取设备状态列表失败 - ${error}`;
    }
  },
  examples: [
    {
      description: "按关键词(航标名称)搜索设备",
      params: {
        keyword: "北塘"
      }
    },
    {
      description: "按单位过滤(北京港航中心)",
      params: {
        selectCmpId: "1234567890"
      }
    }
  ]
}; 