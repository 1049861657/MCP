import mysql from "mysql2/promise";

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
export const getConnection = async (): Promise<mysql.Connection> => {
  return await mysql.createConnection(dbConfig);
}; 