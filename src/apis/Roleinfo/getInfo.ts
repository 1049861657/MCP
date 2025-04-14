import { ApiCategories } from "../../config/api-config";
import { z } from "zod";
import { fetchData, handleLargeResponse } from "../../utils/http-utils";
import { processResponse } from "../../utils/apiResponseProcessor";
import { AUTH_COOKIE, BASE_API_URL } from "../../config/api-config";

// 角色详情响应接口
interface RoleInfoResponse {
  id?: string;
  roleCode?: string;
  roleName?: string;
  description?: string;
  ifCheck?: boolean;
  ifEnabled?: number;
  moduleList?: any[];
  orgNames?: string[];
  orgInfo?: any;
  serialNumber?: number;
}

// 权限菜单项接口
interface MenuItem {
  id?: string;
  parentId?: string;
  menuCode?: string;
  menuName?: string;
  menuType?: string;
  children?: MenuItem[];
  ifCheck?: boolean;
}

// 简化后的权限菜单项
interface SimpleMenuItem {
  menuName: string;
  ifCheck: boolean;
  children?: SimpleMenuItem[];
}

/**
 * 获取角色详情API
 * 此API用于查询特定角色的详细信息
 */
export default {
  id: "getRoleInfo",
  name: "获取角色权限详情",
  description: "根据角色ID查询角色的权限信息",
  category: ApiCategories.ROLEINFO,
  schema: {
    id: z.string().describe("角色ID").source("调用getRoleList工具获取角色列表")
  },
  handler: async ({ id }: { id: string }) => {
    try {
      const url = `${BASE_API_URL}/Roleinfo/getInfo/${id}`;
      const rawResponse = await fetchData(url, 'GET', null, {'Cookie': AUTH_COOKIE});
      const processedResponse = processResponse(rawResponse);
      
      // 只提取moduleList作为最终数据并进行后处理
      if (processedResponse.success && processedResponse.data) {
        const data = processedResponse.data as RoleInfoResponse;
        const moduleList = data.moduleList || [];
        
        // 对moduleList进行后处理，只保留权限名称、是否启用以及子权限
        const simplifiedModuleList = moduleList.map((module: MenuItem) => simplifyMenuItem(module));
        
        // 更新处理后的响应
        processedResponse.data = simplifiedModuleList;
      }
      
      return `${handleLargeResponse(processedResponse)}`;
    } catch (error) {
      const err = error as Error;
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
function simplifyMenuItem(menuItem: MenuItem): SimpleMenuItem {
    const result: SimpleMenuItem = {
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