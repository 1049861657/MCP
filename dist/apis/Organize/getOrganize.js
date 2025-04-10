"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_config_1 = require("../../config/api-config");
const http_utils_1 = require("../../utils/http-utils");
const apiResponseProcessor_1 = require("../../utils/apiResponseProcessor");
const api_config_2 = require("../../config/api-config");
/**
 * 获取当前用户所属机构及其所有下级机构的层级树结构
 */
exports.default = {
    id: "getOrganize",
    name: "获取机构(单位)层级结构",
    description: "获取当前用户所属机构及其所有下级机构的层级树结构",
    category: api_config_1.ApiCategories.ORGANIZE,
    schema: {},
    handler: async () => {
        try {
            const url = `${api_config_2.BASE_API_URL}/Organize/getOrganize`;
            const rawResponse = await (0, http_utils_1.fetchData)(url, 'GET', null, { 'Cookie': api_config_2.AUTH_COOKIE });
            const processedResponse = (0, apiResponseProcessor_1.processResponse)(rawResponse);
            // 判断响应是否成功
            if (!processedResponse.success) {
                return `错误: 获取组织机构层级结构失败`;
            }
            // 获取数据并进行精简
            let organizationData = null;
            if ('data' in processedResponse) {
                // 根据API返回数据结构进行处理
                organizationData = Array.isArray(processedResponse.data) && processedResponse.data.length > 0
                    ? processedResponse.data[0]
                    : processedResponse.data;
            }
            // 用于统计总数的引用对象
            const totalCountRef = { count: 0 };
            // 精简组织结构并统计总数
            const simplifiedHierarchy = simplifyOrganizationHierarchy(organizationData, totalCountRef);
            // 返回精简后的数据
            if (simplifiedHierarchy) {
                return `组织机构层级结构(共计 ${totalCountRef.count} 个单位):\n${(0, http_utils_1.handleLargeResponse)(simplifiedHierarchy)}`;
            }
            else {
                return `未能从API响应中找到有效的组织机构数据`;
            }
        }
        catch (error) {
            return `错误: 获取组织机构层级结构失败 - ${error}`;
        }
    },
    examples: [
        {
            description: "获取用户所属机构及其下级机构的层级树结构",
            params: {}
        }
    ]
};
/**
 * 递归精简组织机构层级结构
 * @param node 原始组织节点
 * @param totalCountRef 引用类型，用于在递归过程中累计总数
 * @returns 精简后的组织节点
 */
function simplifyOrganizationHierarchy(node, totalCountRef = { count: 0 }) {
    if (!node || typeof node !== 'object') {
        return null;
    }
    // 记录当前节点，总数加1
    totalCountRef.count += 1;
    // 提取关键信息
    const nodeId = node.id;
    const nodeName = node.orgName;
    // 构建精简节点
    const simplifiedNode = {
        id: nodeId,
        name: nodeName
    };
    // 处理子节点
    const originalChildren = node.children;
    const simplifiedChildren = [];
    if (originalChildren && Array.isArray(originalChildren)) {
        for (const childNode of originalChildren) {
            const simplifiedChild = simplifyOrganizationHierarchy(childNode, totalCountRef);
            if (simplifiedChild) {
                simplifiedChildren.push(simplifiedChild);
            }
        }
    }
    // 只有当有子节点时才添加children字段和childCount字段
    if (simplifiedChildren.length > 0) {
        simplifiedNode.childCount = simplifiedChildren.length;
        simplifiedNode.children = simplifiedChildren;
    }
    return simplifiedNode;
}
