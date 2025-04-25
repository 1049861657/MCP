/**
 * API全局配置文件
 */
import { getAuthCookie } from '../utils/json-db-utils';

// 基础API URL
export const BASE_API_URL = "http://192.168.1.15:8200/api";

// 获取认证Cookie的函数（替代原来的常量）
export function getApiAuthCookie(): string {
  return getAuthCookie();
}

// 默认分页配置
export const DEFAULT_PAGINATION = {
  CURRENT_PAGE: 1,
  PAGE_SIZE: 15
}; 

// API分类常量
export const ApiCategories = {
  BEACON: "航标设备",
  COMMON: "非主动调用",
  SYSTEM: "系统工具",
  ORGANIZE: "组织机构",
  HISTORICAL: "历史报文",
  USERINFO: "用户管理",
  ROLEINFO: "角色管理",
  LIGHTQUALITY: "灯质管理",
  DEVICEALLOCATION: "设备分配",
  TASKRECORD: "运行参数"
} as const; 