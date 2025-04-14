import { ApiCategories } from "../../config/api-config";
import { fetchData, handleLargeResponse } from "../../utils/http-utils";
import { processResponse } from "../../utils/apiResponseProcessor";
import { AUTH_COOKIE, BASE_API_URL } from "../../config/api-config";

/**
 * 获取当前用户所属机构及其所有下级机构的层级树结构
 */
export default {
  id: "getOrganize",
  name: "获取机构(单位)层级结构",
  description: "获取当前用户所属机构及其所有下级机构的层级树结构",
  category: ApiCategories.ORGANIZE,
  schema: {},
  handler: async () => {
    try {
      const url = `${BASE_API_URL}/Organize/getOrganize`;
      const rawResponse = await fetchData(url, 'GET', null, {'Cookie': AUTH_COOKIE});
      const processedResponse = processResponse(rawResponse);
      
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
      const processedResponse2 = processResponse(simplifiedHierarchy);
      return `${handleLargeResponse(processedResponse2,`组织机构层级结构(共计 ${totalCountRef.count} 个单位)`)}`;
    } catch (error) {
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
function simplifyOrganizationHierarchy(node: any, totalCountRef: { count: number } = { count: 0 }): any {
  if (!node || typeof node !== 'object') {
    return null;
  }

  // 记录当前节点，总数加1
  totalCountRef.count += 1;

  // 提取关键信息
  const nodeId = node.id;
  const nodeName = node.orgName;

  // 构建精简节点
  const simplifiedNode: any = {
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
