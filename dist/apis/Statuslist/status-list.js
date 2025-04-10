"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const api_config_1 = require("../../config/api-config");
const http_utils_1 = require("../../utils/http-utils");
const apiResponseProcessor_1 = require("../../utils/apiResponseProcessor");
const api_config_2 = require("../../config/api-config");
/**
 * 获取设备状态列表API
 */
exports.default = {
    id: "getStatusList",
    name: "获取多个设备(灯器)的最新状态",
    description: "支持分页、关键词搜索(航标名称、设备编号或通信卡号)和按单位过滤，可查询多种报警和通信方式",
    category: api_config_1.ApiCategories.BEACON,
    schema: {
        ifPage: zod_1.z.boolean().describe("是否分页").default(true),
        currentPage: zod_1.z.number().optional().describe("当前页码").default(api_config_2.DEFAULT_PAGINATION.CURRENT_PAGE),
        pageRecord: zod_1.z.number().optional().describe("每页记录数").default(api_config_2.DEFAULT_PAGINATION.PAGE_SIZE),
        keyword: zod_1.z.string().optional().describe("关键词(航标名称、设备编号或通信卡号)"),
        selectCmpId: zod_1.z.string().optional().describe("所属单位或组织的ID").source("调用getOrganize工具获取id"),
        commModeCodeList: zod_1.z.array(zod_1.z.string()).optional().describe("通信方式代号").source("调用枚举工具[commModeCode]"),
        alarmList: zod_1.z.array(zod_1.z.string()).optional().describe("报警内容代号").source("调用枚举工具[alarmCodes]")
    },
    handler: async ({ ifPage, currentPage, pageRecord, keyword, selectCmpId, commModeCodeList, alarmList }) => {
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
            const url = `${api_config_2.BASE_API_URL}/Statuslist/getList`;
            const rawResponse = await (0, http_utils_1.fetchData)(url, 'POST', body, { 'Cookie': api_config_2.AUTH_COOKIE });
            const processedResponse = (0, apiResponseProcessor_1.processResponse)(rawResponse);
            return `获取设备状态列表结果:\n${(0, http_utils_1.handleLargeResponse)(processedResponse, "设备状态列表")}`;
        }
        catch (error) {
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
