/**
 * 系统通用API响应处理工具
 */

/**
 * 分页响应结构
 */
export interface PagedResponse {
  success: boolean;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  data: any[];
  isAllData: boolean; // 标识当前分页是否包含全部数据
}

/**
 * 普通响应结构
 */
export interface SimpleResponse {
  success: boolean;
  data: any[];
}

/**
 * 自定义响应结构（适用于非系统API接口）
 */
export interface CustomResponse {
  success: boolean;
  data: any;
}

/**
 * 处理分页API响应
 * @param response API原始响应
 * @returns 格式化后的响应数据
 */
export function processPagedResponse(response: any): PagedResponse {
  // 检查响应状态
  if (!response || response.rlt !== 0) {
    return {
      success: false,
      totalCount: 0,
      currentPage: 1,
      pageSize: 0,
      data: [],
      isAllData: true
    };
  }

  const totalCount = response.datas.recordCount || 0;
  const currentPage = response.datas.currentPage || 1;
  const pageSize = response.datas.pageRecord || 0;
  const resultData = response.datas.result || [];
  
  // 判断是否包含全部数据
  const isAllData = resultData.length >= totalCount; 

  // 提取并返回格式化数据
  return {
    success: true,
    totalCount,
    currentPage,
    pageSize,
    isAllData,
    data: resultData
  };
}

/**
 * 处理普通API响应（无分页）
 * @param response API原始响应
 * @returns 格式化后的响应数据
 */
export function processSimpleResponse(response: any): SimpleResponse {
  // 检查响应状态
  if (!response || response.rlt !== 0) {
    return {
      success: false,
      data: []
    };
  }

  // 提取并返回格式化数据
  return {
    success: true,
    data: response.datas || []
  };
}

/**
 * 通用API响应处理函数，可以识别并处理分页与非分页响应
 * @param response API原始响应
 * @returns 格式化后的响应数据
 */
export function processResponse(response: any): PagedResponse | SimpleResponse | CustomResponse {
  if (!response) {
    return {
      success: false,
      data: []
    };
  }
  
  // 判断是否为分页响应 (通过检查datas的结构)
  if (response.datas && typeof response.datas === 'object' && !Array.isArray(response.datas) && response.datas.result) {
    return processPagedResponse(response);
  } else if (response.datas !== undefined) {
    return processSimpleResponse(response);
  } else {
    // 处理非系统API接口的情况，没有datas字段时直接使用response作为data
    return {
      success: true,
      data: response
    };
  }
} 