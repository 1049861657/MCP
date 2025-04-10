"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDictionary = loadDictionary;
const fs_1 = __importDefault(require("fs"));
// 字典文件路径
const DICTIONARY_PATH = "E:/testProject/MCP/data/dictionaries/beacon_codes.json";
/**
 * 读取字典文件
 * @returns 字典对象
 */
function loadDictionary() {
    try {
        const data = fs_1.default.readFileSync(DICTIONARY_PATH, 'utf8');
        return JSON.parse(data);
    }
    catch (error) {
        console.error(`错误: 无法读取字典文件 - ${error}`);
        console.log(`尝试读取的路径: ${DICTIONARY_PATH}`);
        return {};
    }
}
