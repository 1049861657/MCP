import http from 'http';

// 最大响应大小（字符数）
const MAX_RESPONSE_SIZE = 32000; // 保守设置32K

/**
 * 处理可能过大的响应，进行截断并添加提示
 * 
 * @param data 需要处理的数据
 * @param aiSummary 专门为AI准备的总结信息，将作为属性添加到JSON对象中
 * @returns 处理后的JSON字符串
 */
export function handleLargeResponse(data: any, aiSummary?: string): string {
  const processedData = { aiSummary, ...data }
  const jsonString = JSON.stringify(processedData, null, 2);
  
  if (jsonString.length <= MAX_RESPONSE_SIZE) {
    return jsonString;
  }
  // 截断数据并添加提示信息
  const truncatedJson = jsonString.substring(0, 500);
  return `部分返回：${truncatedJson}。\n警告:响应数据过大，已截断显示，完整数据大小为 ${jsonString.length} 字符。需要使用分页或其他办法获取完整数据`;
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
export async function fetchData(
  url: string, 
  method: string = 'GET', 
  body?: any, 
  headers: Record<string, string> = {}
): Promise<any> {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    const options: http.RequestOptions = {
      method,
      headers: { ...defaultHeaders, ...headers }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
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