import { ApiCategories } from "../../config/api-config";
import { z } from "zod";
import { fetchData, handleLargeResponse } from "../../utils/http-utils";
import { processResponse } from "../../utils/apiResponseProcessor";
import { AUTH_COOKIE, BASE_API_URL, DEFAULT_PAGINATION } from "../../config/api-config";

// 设备运行参数查询参数接口
interface TaskrecordListParams {
  isPage?: boolean;
  currentPage?: number;
  pageRecord?: number;
  deviceCode: string;
}

/**
 * 获取设备运行参数列表API
 * 此API用于查询特定设备的运行参数数据
 */
export default {
  id: "getTaskrecordList",
  name: "获取设备运行参数列表",
  description: "根据设备编号查询设备的运行参数列表",
  category: ApiCategories.TASKRECORD,
  schema: {
    currentPage: z.number().optional().describe("当前页码").default(DEFAULT_PAGINATION.CURRENT_PAGE),
    pageRecord: z.number().optional().describe("每页记录数").default(DEFAULT_PAGINATION.PAGE_SIZE),
    isPage: z.boolean().optional().describe("是否分页").default(true),
    deviceCode: z.string().describe("设备编号").source("已知卡号->调用数据库工具[SELECT deviceCode FROM tbl_statuslist WHERE cardNumber = '通信卡号';]")
  },
  handler: async ({ 
    currentPage, 
    pageRecord, 
    isPage,
    deviceCode
  }: TaskrecordListParams) => {
    try {
      const body = {
        currentPage,
        pageRecord,
        isPage,
        deviceCode
      };
      
      const url = `${BASE_API_URL}/Taskrecord/getList`;
      const rawResponse = await fetchData(url, 'POST', body, {'Cookie': AUTH_COOKIE});
      const processedResponse = processResponse(rawResponse);

      return `${handleLargeResponse(processedResponse)}`;
    } catch (error) {
      const err = error as Error;
      return `错误: 获取设备运行参数列表失败 - ${err.message}`;
    }
  },
  examples: [
    {
      description: "获取特定设备的运行参数列表",
      params: {
        currentPage: 1,
        pageRecord: 10,
        isPage: true,
        deviceCode: "01030204210002"
      }
    }
  ]
};