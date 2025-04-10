import { z } from "zod";
import { ApiCategories } from "../../config/api-config";
import { handleLargeResponse } from "../../utils/http-utils";
import { loadEnum } from "../../utils/enum-utils";

/**
 * 获取枚举值API
 */
export default {
  id: "getEnumCodes",
  name: "获取枚举值",
  description: "获取指定类型的枚举值列表及其描述",
  category: ApiCategories.COMMON,
  schema: {
    codeType: z.string().describe("枚举类型")
  },
  handler: async ({ codeType }: { codeType: string }) => {
    try {
      // 从本地文件加载枚举值
      const localEnumData = loadEnum();
      if (!localEnumData[codeType]) {
        return `错误: 未找到指定类型的枚举值列表: ${codeType}`;
      }
      
      return `${codeType}枚举值列表:\n${handleLargeResponse(localEnumData[codeType], codeType + "枚举值")}`;
    } catch (error) {
      return `错误: 获取枚举值列表失败 - ${error}`;
    }
  },
  examples: [
    {
      description: "获取通信方式枚举",
      params: {
        codeType: "commModeCode"
      }
    },
    {
      description: "获取报警类型枚举",
      params: {
        codeType: "alarmCodes"
      }
    }
  ]
}; 