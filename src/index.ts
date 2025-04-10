import path from 'path';
import apiServer from './core/server';
import apiLoader from './core/loader';
import { authenticateOnStartup } from './utils/auth-utils';

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
    // 执行登录认证
    console.log("正在进行API认证...");
    await authenticateOnStartup();
    
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
    console.log("提示: 在AI中仅可见三个元工具，但可通过这些工具动态使用所有API");
    
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