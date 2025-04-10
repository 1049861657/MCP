"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_config_1 = require("../../config/api-config");
const zod_1 = require("zod");
const http_utils_1 = require("../../utils/http-utils");
const apiResponseProcessor_1 = require("../../utils/apiResponseProcessor");
const api_config_2 = require("../../config/api-config");
/**
 * 获取角色信息列表API
 * 此API用于查询角色信息列表，支持分页
 */
exports.default = {
    id: "getRoleList",
    name: "获取角色信息列表",
    description: "查询角色信息列表，包含所属公司等",
    category: api_config_1.ApiCategories.ROLEINFO,
    schema: {
        ifPage: zod_1.z.boolean().optional().describe("是否分页").default(true),
        currentPage: zod_1.z.number().optional().describe("当前页码").default(api_config_2.DEFAULT_PAGINATION.CURRENT_PAGE),
        pageRecord: zod_1.z.number().optional().describe("每页记录数").default(api_config_2.DEFAULT_PAGINATION.PAGE_SIZE),
    },
    handler: async ({ ifPage, currentPage, pageRecord, }) => {
        try {
            const body = {
                ifPage,
                currentPage,
                pageRecord,
            };
            const url = `${api_config_2.BASE_API_URL}/Roleinfo/getList`;
            const rawResponse = await (0, http_utils_1.fetchData)(url, 'POST', body, { 'Cookie': api_config_2.AUTH_COOKIE });
            const processedResponse = (0, apiResponseProcessor_1.processResponse)(rawResponse);
            return `获取角色信息列表结果:\n${(0, http_utils_1.handleLargeResponse)(processedResponse, "角色信息列表")}`;
        }
        catch (error) {
            const err = error;
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
