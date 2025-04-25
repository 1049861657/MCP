import fs from 'fs';
import path from 'path';

// JSON 数据库文件路径
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE_PATH = path.resolve(DATA_DIR, 'auth-db.json');

/**
 * 读取JSON数据库
 * @returns 数据库内容
 */
export function readJsonDb(): any {
  try {
    const data = fs.readFileSync(DB_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取数据库失败:', error);
  }
}

/**
 * 写入JSON数据库
 * @param data 要写入的数据
 */
export function writeJsonDb(data: any): void {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('写入数据库失败:', error);
    throw error;
  }
}

/**
 * 获取认证Cookie
 * @returns 认证Cookie字符串
 */
export function getAuthCookie(): string {
  const db = readJsonDb();
  return db.auth?.cookie || '';
}

/**
 * 设置认证Cookie
 * @param cookie 新的认证Cookie
 */
export function setAuthCookie(cookie: string): void {
  const db = readJsonDb();
  
  // 确保auth对象存在
  if (!db.auth) {
    db.auth = {};
  }
  
  // 更新cookie值
  db.auth.cookie = cookie;
  
  // 写入数据库
  writeJsonDb(db);
} 