"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnum = loadEnum;
const fs_1 = __importDefault(require("fs"));
// 枚举文件路径
const ENUM_PATH = "E:/testProject/MCP/data/Enum/beacon_enum.json";
/**
 * 读取枚举文件
 * @returns 枚举对象
 */
function loadEnum() {
    try {
        const data = fs_1.default.readFileSync(ENUM_PATH, 'utf8');
        return JSON.parse(data);
    }
    catch (error) {
        console.error(`错误: 无法读取枚举文件 - ${error}`);
        console.log(`尝试读取的路径: ${ENUM_PATH}`);
        return {};
    }
}
