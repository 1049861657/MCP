"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_config_1 = require("../../config/api-config");
const zod_1 = require("zod");
const http_utils_1 = require("../../utils/http-utils");
const apiResponseProcessor_1 = require("../../utils/apiResponseProcessor");
const api_config_2 = require("../../config/api-config");
/**
 * 获取灯质信息列表API
 * 此API用于查询灯质信息列表，支持分页和名称筛选
 */
exports.default = {
    id: "getLightQualityList",
    name: "获取灯质信息列表",
    description: "查询灯质信息列表，支持分页筛选",
    category: api_config_1.ApiCategories.LIGHTQUALITY,
    schema: {
        ifPage: zod_1.z.boolean().optional().describe("是否分页").default(true),
        currentPage: zod_1.z.number().optional().describe("当前页码").default(api_config_2.DEFAULT_PAGINATION.CURRENT_PAGE),
        pageRecord: zod_1.z.number().optional().describe("每页记录数").default(api_config_2.DEFAULT_PAGINATION.PAGE_SIZE),
        lightQualityName: zod_1.z.string().optional().describe("灯质名称"),
        ifUsed: zod_1.z.string().optional().describe("是否常用(0:否,1:是)")
    },
    handler: async ({ ifPage, currentPage, pageRecord, lightQualityName, ifUsed }) => {
        try {
            const body = {
                ifPage,
                currentPage,
                pageRecord,
                lightQualityName,
                ifUsed
            };
            const url = `${api_config_2.BASE_API_URL}/Lightquality/getList`;
            const rawResponse = await (0, http_utils_1.fetchData)(url, 'POST', body, { 'Cookie': api_config_2.AUTH_COOKIE });
            const processedResponse = (0, apiResponseProcessor_1.processResponse)(rawResponse);
            return `获取灯质信息列表结果:\n${(0, http_utils_1.handleLargeResponse)(processedResponse, "灯质信息列表")}`;
        }
        catch (error) {
            const err = error;
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
