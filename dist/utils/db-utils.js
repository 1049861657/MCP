"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConnection = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
// 数据库连接配置
const dbConfig = {
    host: "192.168.1.15",
    port: 3307,
    user: "root",
    password: "SHENLAN@2016",
    database: "markmissgs"
};
/**
 * 获取数据库连接
 * @returns Promise<mysql.Connection>
 */
const getConnection = async () => {
    return await promise_1.default.createConnection(dbConfig);
};
exports.getConnection = getConnection;
