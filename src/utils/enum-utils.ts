import fs from 'fs';
import path from 'path';

// 枚举文件路径
const ENUM_PATH = path.resolve(__dirname, '../../data/Enum/beacon_enum.json');

/**
 * 读取枚举文件
 * @returns 枚举对象
 */
export function loadEnum(): any {
  try {
    const data = fs.readFileSync(ENUM_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`错误: 无法读取枚举文件 - ${error}`);
    console.log(`尝试读取的路径: ${ENUM_PATH}`);
    return {};
  }
} 