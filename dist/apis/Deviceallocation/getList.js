"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_config_1 = require("../../config/api-config");
const zod_1 = require("zod");
const http_utils_1 = require("../../utils/http-utils");
const apiResponseProcessor_1 = require("../../utils/apiResponseProcessor");
const api_config_2 = require("../../config/api-config");
/**
 * 获取设备分配列表API
 * 此API用于查询设备分配信息列表，支持分页和类型筛选
 */
exports.default = {
    id: "getDeviceList",
    name: "获取设备分配列表",
    description: "查询设备分配状态列表",
    category: api_config_1.ApiCategories.DEVICEALLOCATION,
    schema: {
        ifPage: zod_1.z.boolean().optional().describe("是否分页").default(true),
        currentPage: zod_1.z.number().optional().describe("当前页码").default(api_config_2.DEFAULT_PAGINATION.CURRENT_PAGE),
        pageRecord: zod_1.z.number().optional().describe("每页记录数").default(api_config_2.DEFAULT_PAGINATION.PAGE_SIZE),
        type: zod_1.z.string().optional().describe("是否已分配(0:否,1:是)")
    },
    handler: async ({ ifPage, currentPage, pageRecord, type }) => {
        try {
            const body = {
                ifPage,
                currentPage,
                pageRecord,
                type
            };
            const url = `${api_config_2.BASE_API_URL}/Beidoucard/getDeviceList`;
            const rawResponse = await (0, http_utils_1.fetchData)(url, 'POST', body, { 'Cookie': api_config_2.AUTH_COOKIE });
            const processedResponse = (0, apiResponseProcessor_1.processResponse)(rawResponse);
            return `获取设备分配列表结果:\n${(0, http_utils_1.handleLargeResponse)(processedResponse, "设备分配列表")}`;
        }
        catch (error) {
            const err = error;
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
