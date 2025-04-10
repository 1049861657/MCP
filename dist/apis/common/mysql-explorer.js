"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_config_1 = require("../../config/api-config");
const db_utils_1 = require("../../utils/db-utils");
const zod_1 = require("zod");
/**
 * MySQL Explorer API
 * 提供数据库查询功能
 */
exports.default = {
    id: "doSqlQuery",
    name: "执行数据库查询",
    description: "执行SQL查询并返回结果。可用于SELECT、INSERT、UPDATE、DELETE等标准SQL语法",
    category: api_config_1.ApiCategories.COMMON,
    schema: {
        sql: zod_1.z.string().describe("要执行的SQL查询语句")
    },
    handler: async (params) => {
        const connection = await (0, db_utils_1.getConnection)();
        try {
            const [results] = await connection.execute(params.sql);
            return JSON.stringify(results, null, 2);
        }
        catch (err) {
            const error = err;
            throw new Error(`数据库查询错误: ${error.message}`);
        }
        finally {
            await connection.end();
        }
    },
    examples: [
        {
            description: "查询用户表前10条数据",
            params: {
                sql: "SELECT * FROM users LIMIT 10"
            }
        }
    ]
};
