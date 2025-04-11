import fs from 'fs';
import path from 'path';

// 字典文件路径
const DICTIONARY_PATH = path.resolve(__dirname, '../../data/dictionaries/beacon_codes.json');

/**
 * 读取字典文件
 * @returns 字典对象
 */
export function loadDictionary(): any {
  try {
    const data = fs.readFileSync(DICTIONARY_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`错误: 无法读取字典文件 - ${error}`);
    console.log(`尝试读取的路径: ${DICTIONARY_PATH}`);
    return {};
  }
} 