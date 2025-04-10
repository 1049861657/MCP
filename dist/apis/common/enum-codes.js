"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const api_config_1 = require("../../config/api-config");
const http_utils_1 = require("../../utils/http-utils");
const enum_utils_1 = require("../../utils/enum-utils");
/**
 * 获取枚举值API
 */
exports.default = {
    id: "getEnumCodes",
    name: "获取枚举值",
    description: "获取指定类型的枚举值列表及其描述",
    category: api_config_1.ApiCategories.COMMON,
    schema: {
        codeType: zod_1.z.string().describe("枚举类型")
    },
    handler: async ({ codeType }) => {
        try {
            // 从本地文件加载枚举值
            const localEnumData = (0, enum_utils_1.loadEnum)();
            if (!localEnumData[codeType]) {
                return `错误: 未找到指定类型的枚举值列表: ${codeType}`;
            }
            return `${codeType}枚举值列表:\n${(0, http_utils_1.handleLargeResponse)(localEnumData[codeType], codeType + "枚举值")}`;
        }
        catch (error) {
            return `错误: 获取枚举值列表失败 - ${error}`;
        }
    },
    examples: [
        {
            description: "获取通信方式枚举",
            params: {
                codeType: "commModeCode"
            }
        },
        {
            description: "获取报警类型枚举",
            params: {
                codeType: "alarmCodes"
            }
        }
    ]
};
