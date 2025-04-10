/**
 * API全局配置文件
 */

// 基础API URL
export const BASE_API_URL = "http://192.168.1.15:8200/api";

// API认证Cookie(自动更新)
export const AUTH_COOKIE = 'markmissgs=ODk4NzA2ZTYtZjVlZC00NDQzLWE0MzktN2ZkZDU0MDRlYjk4';

// 默认分页配置
export const DEFAULT_PAGINATION = {
  CURRENT_PAGE: 1,
  PAGE_SIZE: 15
}; 

// API分类常量
export const ApiCategories = {
  BEACON: "航标设备",
  COMMON: "通用工具",
  SYSTEM: "系统工具",
  DATA: "数据处理",
  ORGANIZE: "组织机构",
  HISTORICAL: "历史报文",
  USERINFO: "用户管理",
  ROLEINFO: "角色管理",
  LIGHTQUALITY: "灯质管理",
  DEVICEALLOCATION: "设备分配"
} as const; 