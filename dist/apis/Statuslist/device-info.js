"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const api_config_1 = require("../../config/api-config");
const http_utils_1 = require("../../utils/http-utils");
const apiResponseProcessor_1 = require("../../utils/apiResponseProcessor");
const api_config_2 = require("../../config/api-config");
/**
 * 获取设备信息API
 */
exports.default = {
    id: "getDeviceInfo",
    name: "获取单个设备的最新状态",
    description: "利用设备编号去查询单个设备详细信息",
    category: api_config_1.ApiCategories.BEACON,
    schema: {
        deviceCode: zod_1.z.string().describe("设备编号").source("已知卡号->调用数据库工具[SELECT deviceCode FROM tbl_statuslist WHERE cardNumber = '通信卡号';]")
    },
    handler: async ({ deviceCode }) => {
        try {
            const url = `${api_config_2.BASE_API_URL}/Statuslist/getInfo/${deviceCode}`;
            const rawResponse = await (0, http_utils_1.fetchData)(url, 'GET', null, { 'Cookie': api_config_2.AUTH_COOKIE });
            const processedResponse = (0, apiResponseProcessor_1.processResponse)(rawResponse);
            return `获取设备详细信息结果:\n${(0, http_utils_1.handleLargeResponse)(processedResponse, "设备详细信息")}`;
        }
        catch (error) {
            return `错误: 获取设备信息失败 - ${error}`;
        }
    },
    examples: [
        {
            description: "获取指定设备的信息",
            params: {
                deviceCode: "SL0001"
            }
        }
    ]
};
