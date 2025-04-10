"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleLargeResponse = handleLargeResponse;
exports.fetchData = fetchData;
const http_1 = __importDefault(require("http"));
// 最大响应大小（字符数）
const MAX_RESPONSE_SIZE = 32000; // 保守设置32K
/**
 * 处理可能过大的响应，进行截断并添加提示
 *
 * @param data 需要处理的数据
 * @param label 数据标签
 * @returns 处理后的JSON字符串
 */
function handleLargeResponse(data, label = "响应") {
    const jsonString = JSON.stringify(data, null, 2);
    if (jsonString.length <= MAX_RESPONSE_SIZE) {
        return jsonString;
    }
    // 截断数据并添加提示信息
    const truncatedJson = jsonString.substring(0, 500);
    return `部分返回：${truncatedJson}。\n警告:${label}数据过大，已截断显示，完整数据大小为 ${jsonString.length} 字符。需要使用分页或其他办法获取完整数据`;
}
/**
 * 发送HTTP请求
 *
 * @param url 请求URL
 * @param method HTTP方法
 * @param body 请求体
 * @param headers 请求头
 * @returns Promise<any>
 */
async function fetchData(url, method = 'GET', body, headers = {}) {
    return new Promise((resolve, reject) => {
        const defaultHeaders = {
            'Content-Type': 'application/json',
        };
        const options = {
            method,
            headers: { ...defaultHeaders, ...headers }
        };
        const req = http_1.default.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                }
                catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', (err) => {
            reject(err);
        });
        if (body && method !== 'GET') {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}
