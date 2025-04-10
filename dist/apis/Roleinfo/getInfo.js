"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_config_1 = require("../../config/api-config");
const zod_1 = require("zod");
const http_utils_1 = require("../../utils/http-utils");
const apiResponseProcessor_1 = require("../../utils/apiResponseProcessor");
const api_config_2 = require("../../config/api-config");
/**
 * 获取角色详情API
 * 此API用于查询特定角色的详细信息
 */
exports.default = {
    id: "getRoleInfo",
    name: "获取角色权限详情",
    description: "根据角色ID查询角色的权限信息",
    category: api_config_1.ApiCategories.ROLEINFO,
    schema: {
        id: zod_1.z.string().describe("角色ID").source("调用getRoleList工具获取角色列表")
    },
    handler: async ({ id }) => {
        try {
            const url = `${api_config_2.BASE_API_URL}/Roleinfo/getInfo/${id}`;
            const rawResponse = await (0, http_utils_1.fetchData)(url, 'GET', null, { 'Cookie': api_config_2.AUTH_COOKIE });
            const processedResponse = (0, apiResponseProcessor_1.processResponse)(rawResponse);
            // 只提取moduleList作为最终数据并进行后处理
            if (processedResponse.success && processedResponse.data) {
                const data = processedResponse.data;
                const moduleList = data.moduleList || [];
                // 对moduleList进行后处理，只保留权限名称、是否启用以及子权限
                const simplifiedModuleList = moduleList.map((module) => simplifyMenuItem(module));
                // 更新处理后的响应
                processedResponse.data = simplifiedModuleList;
            }
            return `获取角色权限结果:\n${(0, http_utils_1.handleLargeResponse)(processedResponse, "角色权限")}`;
        }
        catch (error) {
            const err = error;
            return `错误: 获取角色详情失败 - ${err.message}`;
        }
    },
    examples: [
        {
            description: "获取特定角色的权限详情",
            params: {
                id: "447e389c0be5441ca05050d11d7e3d1b"
            }
        }
    ]
};
/**
 * 简化权限菜单项，只保留名称、是否启用和子权限
 * @param menuItem 原始菜单项
 * @returns 简化后的菜单项
 */
function simplifyMenuItem(menuItem) {
    const result = {
        menuName: menuItem.menuName || '',
        ifCheck: !!menuItem.ifCheck
    };
    // 只有当有子权限时才添加children属性
    if (menuItem.children && menuItem.children.length > 0) {
        const simplifiedChildren = menuItem.children.map(child => simplifyMenuItem(child));
        // 过滤掉空的children数组，避免无效的嵌套
        if (simplifiedChildren.length > 0) {
            result.children = simplifiedChildren;
        }
    }
    return result;
}
