"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_config_1 = require("../../config/api-config");
const http_utils_1 = require("../../utils/http-utils");
const dictionary_utils_1 = require("../../utils/dictionary-utils");
/**
 * 获取所有字典API
 */
exports.default = {
    id: "getAllDictionaries",
    name: "获取所有字典",
    description: "通常用于其他工具调用结果里返回字段里有代号时，需要转换为中文",
    category: api_config_1.ApiCategories.COMMON,
    schema: {},
    handler: async () => {
        try {
            const dictionary = (0, dictionary_utils_1.loadDictionary)();
            return `字典内容:\n${(0, http_utils_1.handleLargeResponse)(dictionary, "字典")}`;
        }
        catch (error) {
            return `错误: 获取字典失败 - ${error}`;
        }
    },
    examples: [
        {
            description: "获取所有字典数据",
            params: {}
        }
    ]
};
