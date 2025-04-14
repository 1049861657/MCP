import { ApiCategories } from "../../config/api-config";
import { processResponse } from "../../utils/apiResponseProcessor";
import { getConnection } from "../../utils/db-utils";
import { z } from "zod";
import { handleLargeResponse } from "../../utils/http-utils";

/**
 * MySQL Explorer API
 * 提供数据库查询功能
 */
export default {
  id: "doSqlQuery",
  name: "执行数据库查询",
  description: "执行SQL查询并返回结果。可用于SELECT、INSERT、UPDATE、DELETE等标准SQL语法。不推荐优先使用,除非有明确需求",
  category: ApiCategories.COMMON,
  schema: {
    sql: z.string().describe("要执行的SQL查询语句")
  },
  handler: async (params: { sql: string }) => {
    const connection = await getConnection();
    try {
      const [results] = await connection.execute(params.sql);
      const processedResponse = processResponse(results);
      return `${handleLargeResponse(processedResponse)}`;
    } catch (err) {
      const error = err as Error;
      throw new Error(`数据库查询错误: ${error.message}`);
    } finally {
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