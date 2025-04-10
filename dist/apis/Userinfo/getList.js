"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_config_1 = require("../../config/api-config");
const zod_1 = require("zod");
const http_utils_1 = require("../../utils/http-utils");
const apiResponseProcessor_1 = require("../../utils/apiResponseProcessor");
const api_config_2 = require("../../config/api-config");
/**
 * 获取用户信息列表API
 * 此API用于查询用户信息列表，支持分页和条件筛选
 */
exports.default = {
    id: "getUserList",
    name: "获取用户信息列表",
    description: "查询用户信息列表,支持按用户名、组织机构ID等条件筛选",
    category: api_config_1.ApiCategories.USERINFO,
    schema: {
        ifPage: zod_1.z.boolean().describe("是否分页").default(true),
        currentPage: zod_1.z.number().optional().describe("当前页码").default(api_config_2.DEFAULT_PAGINATION.CURRENT_PAGE),
        pageRecord: zod_1.z.number().optional().describe("每页记录数").default(api_config_2.DEFAULT_PAGINATION.PAGE_SIZE),
        username: zod_1.z.string().optional().describe("用户名"),
        orgId: zod_1.z.string().optional().describe("所属单位或组织的ID").source("调用getOrganize工具获取id"),
        phone: zod_1.z.string().optional().describe("电话号码"),
        ifAll: zod_1.z.number().optional().describe("是否包含下属公司(0:不包含,1:包含)").default(1)
    },
    handler: async ({ ifPage, currentPage, pageRecord, username, orgId, phone, ifAll }) => {
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
            const url = `${api_config_2.BASE_API_URL}/Userinfo/getList`;
            const rawResponse = await (0, http_utils_1.fetchData)(url, 'POST', body, { 'Cookie': api_config_2.AUTH_COOKIE });
            const processedResponse = (0, apiResponseProcessor_1.processResponse)(rawResponse);
            return `获取用户信息列表结果:\n${(0, http_utils_1.handleLargeResponse)(processedResponse, "用户信息列表")}`;
        }
        catch (error) {
            const err = error;
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
