import path from 'path';
import { config as loadEnv } from 'dotenv';
loadEnv(); // 加载 .env，早于任何模块读取 process.env
import apiServer from './core/server';
import apiLoader from './core/loader';

// 初始化API加载器配置
const apiLoaderConfig = {
  apiRootDir: path.join(__dirname, 'apis'),
  enableAutoReload: true,
  watchInterval: 5000,
  loadOnStart: true,
  includeSubdirs: true,
  fileExtensions: ['.js', '.ts'],
  debug: true
};

/**
 * 启动服务器
 */
async function startup() {
  console.log("正在启动动态API服务器...");
  
  try {
    // 初始化服务器
    apiServer.initialize();
    console.log("已初始化API服务器");
    
    // 配置API加载器
    Object.assign(apiLoader, { config: apiLoaderConfig });
    
    // 启动API加载器
    console.log("正在加载API模块...");
    await apiLoader.start();
    
    // 启动服务器
    console.log("正在启动MCP服务器...");
    await apiServer.start();
    
    console.log("动态API服务器启动完成！");
    console.log(
      "传输: MCP Streamable HTTP（会话请使用响应头中的会话机制；客户端需支持 HTTP + mcp-session-id）"
    );
    console.log("提示: 仅暴露三个元工具，可通过其动态调用已加载 API");
    
    // 设置进程关闭处理
    setupShutdown();
  } catch (error) {
    console.error("启动失败:", error);
    process.exit(1);
  }
}

/**
 * 设置服务器关闭处理
 */
function setupShutdown() {
  const cleanup = async () => {
    console.log("\n正在关闭服务器...");
    
    try {
      // 停止API加载器
      apiLoader.stop();
      console.log("已停止API加载器");
      
      // 停止服务器
      await apiServer.stop();
      console.log("已停止MCP服务器");
      
      process.exit(0);
    } catch (error) {
      console.error("关闭过程中发生错误:", error);
      process.exit(1);
    }
  };
  
  // 监听关闭信号
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGUSR2', cleanup); // 用于Nodemon重启
  
  // 监听未捕获的异常
  process.on('uncaughtException', (error) => {
    console.error("未捕获的异常:", error);
    cleanup().catch(() => process.exit(1));
  });
  
  // 监听未处理的Promise拒绝
  process.on('unhandledRejection', (reason, promise) => {
    console.error("未处理的Promise拒绝:", reason);
    // 不立即关闭，只是记录
  });
}

// 启动服务器
startup();
