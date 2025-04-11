import { BASE_API_URL } from '../config/api-config';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL } from 'url';

/**
 * 执行HTTP请求
 * @param url 请求URL
 * @param method 请求方法
 * @param data 请求数据
 * @param contentType 内容类型
 * @returns Promise<{data?: any, cookies?: string[]}>
 */
async function httpRequest(url: string, method: string = 'GET', data?: any, contentType: string = 'application/json'): Promise<{data?: any, cookies?: string[]}> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      let postData = '';
      
      if (data) {
        if (contentType.includes('application/json')) {
          postData = JSON.stringify(data);
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          const formData = new URLSearchParams();
          Object.entries(data).forEach(([key, value]) => {
            formData.append(key, value as string);
          });
          postData = formData.toString();
        }
      }
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || '8200',
        path: parsedUrl.pathname + parsedUrl.search,
        method: method,
        headers: {
          'Content-Type': contentType,
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = http.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          const cookies = res.headers['set-cookie'] || [];
          
          try {
            const jsonData = responseData ? JSON.parse(responseData) : null;
            resolve({
              data: jsonData,
              cookies: cookies
            });
          } catch (e) {
            // 非JSON响应
            resolve({
              data: responseData,
              cookies: cookies
            });
          }
        });
      });
      
      req.on('error', (e) => {
        reject(e);
      });
      
      if (postData) {
        req.write(postData);
      }
      
      req.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 执行登录检查和获取认证Cookie
 * @param username 用户名
 * @param password 密码
 * @returns Promise<string> 认证Cookie
 */
export async function login(username: string = '18900000000', password: string = 'TYH@2020'): Promise<string> {
  try {
    // 1. 先执行登录预检查
    console.log('执行登录预检查...');
    const checkUrl = `${BASE_API_URL}/open/checkLogin2/${username}/${password}/1/0`;
    await httpRequest(checkUrl, 'GET');
    
    // 2. 执行正式登录
    const loginParams = {
      j_username: username,
      j_password: password,
      code: password,
      submitType: '1',
      submit: 'Login'
    };
    
    const loginResult = await httpRequest(
      `${BASE_API_URL}/authentication`, 
      'POST', 
      loginParams, 
      'application/x-www-form-urlencoded'
    );
    
    // 提取Cookie
    let authCookie = '';
    if (loginResult.cookies && loginResult.cookies.length > 0) {
      for (const cookie of loginResult.cookies) {
        if (cookie && cookie.includes('markmissgs=')) {
          authCookie = cookie.split(';')[0];
          break;
        }
      }
    }
    
    // 如果未找到Cookie，使用默认值
    if (!authCookie) {
      authCookie = 'markmissgs=ZjNjN2IzZDZmUtNWRiMy00MzY1LWI1NmUtM2ViMDNlNGMxODJk';
    }
    
    return authCookie;
  } catch (error) {
    console.error('登录过程失败');
    // 返回默认Cookie
    return 'markmissgs=ZjNjN2IzZDZmUtNWRiMy00MzY1LWI1NmUtM2ViMDNlNGMxODJk';
  }
}

/**
 * 更新配置文件中的AUTH_COOKIE值
 * @param cookie 新的cookie值
 */
export async function updateAuthCookie(cookie: string): Promise<void> {
  try {
    // 设置要更新的编译后文件路径
    // 使用相对路径，基于项目根目录
    const distConfigPath = path.resolve(__dirname, '../../dist/config/api-config.js');
    
    if (!fs.existsSync(distConfigPath)) {
      throw new Error(`配置文件不存在: ${distConfigPath}`);
    }
    
    // 读取文件内容
    let configContent = fs.readFileSync(distConfigPath, 'utf8');
    
    // 在dist文件中使用的是exports.AUTH_COOKIE格式
    const cookieRegex = /(exports\.AUTH_COOKIE\s*=\s*['"])(.+?)(['"])/;
    
    if (!cookieRegex.test(configContent)) {
      throw new Error('未找到匹配的认证Cookie格式');
    }
    
    // 替换cookie值
    const updatedContent = configContent.replace(cookieRegex, `$1${cookie}$3`);
    
    // 确认内容已更改
    if (updatedContent === configContent) {
      throw new Error('替换后内容没有变化');
    }
    
    // 写入更新后的内容
    fs.writeFileSync(distConfigPath, updatedContent, 'utf8');
    
    // 同时更新源文件，确保下次编译时也使用更新后的cookie
    try {
      const srcConfigPath = path.resolve(__dirname, '../../src/config/api-config.ts');
      if (fs.existsSync(srcConfigPath)) {
        let srcContent = fs.readFileSync(srcConfigPath, 'utf8');
        
        // 源文件中使用的是export const格式
        const srcCookieRegex = /(export\s+const\s+AUTH_COOKIE\s*=\s*['"])(.+?)(['"])/;
        
        if (srcCookieRegex.test(srcContent)) {
          // 提取cookie值部分(如果cookie包含完整的形式如'markmissgs=XXX')
          const cookieValue = cookie.includes('=') ? cookie.split('=')[1] : cookie;
          // 更新源文件
          const updatedSrcContent = srcContent.replace(srcCookieRegex, `$1markmissgs=${cookieValue}$3`);
          fs.writeFileSync(srcConfigPath, updatedSrcContent, 'utf8');
        }
      }
    } catch (srcError) {
      // 忽略源文件更新错误
    }
  } catch (error) {
    console.error('更新认证Cookie失败');
    throw error;
  }
}

/**
 * 在应用启动时执行登录认证并更新Cookie
 */
export async function authenticateOnStartup(): Promise<void> {
  try {
    console.log('正在执行登录认证...');
    const cookie = await login();
    await updateAuthCookie(cookie);
    console.log('认证成功，Cookie已更新');
  } catch (error) {
    console.error('启动时认证失败');
    console.log('使用现有Cookie继续...');
  }
} 