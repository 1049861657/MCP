import fs from 'fs';
import path from 'path';
import apiRegistry from './registry';
import { ApiDefinition, ApiCategory } from './registry';

/**
 * API加载器配置接口
 */
export interface ApiLoaderConfig {
  /**
   * API目录的根路径
   */
  apiRootDir: string;
  
  /**
   * 是否启用自动重新加载（监视文件变化）
   */
  enableAutoReload?: boolean;
  
  /**
   * 文件监视间隔（毫秒）
   */
  watchInterval?: number;
  
  /**
   * 是否在启动时加载所有API
   */
  loadOnStart?: boolean;
  
  /**
   * 是否加载子目录
   */
  includeSubdirs?: boolean;
  
  /**
   * API文件扩展名过滤器
   */
  fileExtensions?: string[];
  
  /**
   * API文件加载前的处理函数
   */
  beforeLoad?: (filePath: string) => boolean | Promise<boolean>;
  
  /**
   * API加载后的处理函数
   */
  afterLoad?: (apiDef: ApiDefinition) => void;
  
  /**
   * 是否启用调试模式
   */
  debug?: boolean;
}

/**
 * API加载器默认配置
 */
const DEFAULT_CONFIG: ApiLoaderConfig = {
  apiRootDir: path.join(process.cwd(), 'src', 'apis'),
  enableAutoReload: false,
  watchInterval: 5000,
  loadOnStart: true,
  includeSubdirs: true,
  fileExtensions: ['.js', '.ts'],
};

/**
 * API加载器类 - 负责扫描和加载API模块
 */
export class ApiLoader {
  private config: ApiLoaderConfig;
  private watchTimers: Map<string, NodeJS.Timeout> = new Map();
  private loadedFiles: Map<string, number> = new Map(); // 文件路径 -> 上次修改时间
  
  constructor(config: Partial<ApiLoaderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 启动API加载器
   */
  async start(): Promise<void> {
    if (this.config.loadOnStart) {
      await this.loadAllApis();
    }
    
    if (this.config.enableAutoReload) {
      this.startWatching();
    }
  }
  
  /**
   * 停止API加载器
   */
  stop(): void {
    this.stopWatching();
  }
  
  /**
   * 开始监视API目录变化
   */
  private startWatching(): void {
    this.stopWatching();
    
    // 为每个子目录设置监视器
    const directories = [this.config.apiRootDir];
    
    if (this.config.includeSubdirs) {
      const subdirs = this.findSubdirectories(this.config.apiRootDir);
      directories.push(...subdirs);
    }
    
    for (const dir of directories) {
      const timer = setInterval(() => {
        this.checkDirectoryChanges(dir);
      }, this.config.watchInterval);
      
      this.watchTimers.set(dir, timer);
    }
    
    if (this.config.debug) {
      console.log(`已启动API目录监视,间隔: ${this.config.watchInterval}ms，监视目录数: ${directories.length}`);
    }
  }
  
  /**
   * 停止所有监视器
   */
  private stopWatching(): void {
    for (const timer of this.watchTimers.values()) {
      clearInterval(timer);
    }
    
    this.watchTimers.clear();
  }
  
  /**
   * 检查目录变化
   */
  private async checkDirectoryChanges(dir: string): Promise<void> {
    try {
      if (!fs.existsSync(dir)) {
        return;
      }
      
      const files = fs.readdirSync(dir)
        .filter(file => {
          const ext = path.extname(file);
          return (this.config.fileExtensions?.includes(ext) ?? true);
        })
        .map(file => path.join(dir, file));
      
      for (const file of files) {
        try {
          // 跳过index文件和测试文件
          if (path.basename(file).startsWith('index.') || 
              path.basename(file).includes('.test.') || 
              path.basename(file).includes('.spec.')) {
            continue;
          }
          
          const stats = fs.statSync(file);
          const lastModified = this.loadedFiles.get(file);
          
          // 文件是新的或已修改
          if (!lastModified || stats.mtimeMs > lastModified) {
            if (this.config.debug) {
              console.log(`检测到API文件变化: ${file}`);
            }
            
            await this.loadApiFile(file);
            this.loadedFiles.set(file, stats.mtimeMs);
          }
        } catch (error) {
          console.error(`检查文件变化失败: ${file}`, error);
        }
      }
      
      // 检查已删除的文件
      for (const [file] of this.loadedFiles) {
        if (file.startsWith(dir) && !fs.existsSync(file)) {
          if (this.config.debug) {
            console.log(`检测到API文件已删除: ${file}`);
          }
          
          // 从加载记录中移除
          this.loadedFiles.delete(file);
          
          // 尝试从API名称推断API ID并注销
          const fileName = path.basename(file, path.extname(file));
          // 将文件名转换为可能的API ID (kebab-case -> camelCase)
          const possibleApiId = fileName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
          
          if (apiRegistry.hasApi(possibleApiId)) {
            apiRegistry.unregister(possibleApiId);
          }
        }
      }
    } catch (error) {
      console.error(`检查目录变化失败: ${dir}`, error);
    }
  }
  
  /**
   * 查找子目录
   */
  private findSubdirectories(rootDir: string): string[] {
    if (!fs.existsSync(rootDir)) {
      return [];
    }
    
    const result: string[] = [];
    
    const items = fs.readdirSync(rootDir);
    for (const item of items) {
      const itemPath = path.join(rootDir, item);
      
      if (fs.statSync(itemPath).isDirectory()) {
        result.push(itemPath);
        
        // 递归查找子目录的子目录
        const subdirs = this.findSubdirectories(itemPath);
        result.push(...subdirs);
      }
    }
    
    return result;
  }
  
  /**
   * 加载所有API
   */
  async loadAllApis(): Promise<number> {
    try {
      if (!fs.existsSync(this.config.apiRootDir)) {
        console.warn(`警告: API目录不存在：${this.config.apiRootDir}`);
        return 0;
      }
      
      let loadedCount = 0;
      const directories = [this.config.apiRootDir];
      
      // 如果启用了子目录加载，添加所有子目录
      if (this.config.includeSubdirs) {
        const subdirs = this.findSubdirectories(this.config.apiRootDir);
        directories.push(...subdirs);
      }
      
      // 重置已加载文件记录
      this.loadedFiles.clear();
      
      // 遍历目录加载API
      for (const dir of directories) {
        const files = fs.readdirSync(dir)
          .filter(file => {
            const ext = path.extname(file);
            // 跳过index文件
            return (this.config.fileExtensions?.includes(ext) ?? true) && 
                   !file.startsWith('index.');
          })
          .map(file => path.join(dir, file));
        
        // 并行加载所有API文件
        const results = await Promise.all(files.map(async file => {
          try {
            // 跳过测试文件
            if (file.includes('.test.') || file.includes('.spec.')) {
              return 0;
            }
            
            const loadResult = await this.loadApiFile(file);
            if (loadResult > 0) {
              // 记录文件的最后修改时间
              const stats = fs.statSync(file);
              this.loadedFiles.set(file, stats.mtimeMs);
            }
            return loadResult;
          } catch (err) {
            console.error(`错误: 加载API文件失败 "${file}":`, err);
            return 0;
          }
        }));
        
        // 统计加载的API数量
        loadedCount += results.reduce((sum, count) => sum + count, 0);
      }
      
      console.log(`已加载 ${loadedCount} 个API。`);
      return loadedCount;
    } catch (err) {
      console.error("加载API失败:", err);
      return 0;
    }
  }
  
  /**
   * 加载单个API文件
   */
  async loadApiFile(filePath: string): Promise<number> {
    try {
      // 如果配置了文件加载前处理函数，且处理结果为false，则跳过此文件
      if (this.config.beforeLoad) {
        const shouldLoad = await Promise.resolve(this.config.beforeLoad(filePath));
        if (!shouldLoad) {
          return 0;
        }
      }
      
      // 清除模块缓存，确保重新加载最新版本
      const modulePath = require.resolve(filePath);
      delete require.cache[modulePath];
      
      // 加载模块
      const module = require(filePath);
      
      // 提取模块所在目录信息，用于确定API分类
      const relativePath = path.relative(this.config.apiRootDir, filePath);
      const pathParts = relativePath.split(path.sep);
      const categoryDir = pathParts.length > 0 ? pathParts[0] : '';
      
      // 处理模块导出
      let apis: ApiDefinition[] = [];
      
      // 如果模块导出是一个数组，则假定它是API定义数组
      if (Array.isArray(module)) {
        apis = module;
      }
      // 如果模块导出默认为API定义，则使用它
      else if (module.default) {
        if (Array.isArray(module.default)) {
          apis = module.default;
        } else if (this.isApiDefinition(module.default)) {
          const apiDef = module.default;
          apis = [apiDef];
        }
      }
      // 否则，尝试查找所有导出中的API定义
      else {
        for (const key in module) {
          const exportedItem = module[key];
          if (this.isApiDefinition(exportedItem)) {
            apis.push(exportedItem);
          }
        }
      }
      
      // 注册所有找到的API
      if (apis.length > 0) {
        for (const api of apis) {
          // 在API上设置模块目录信息
          (api as any).__moduleDirectory = categoryDir;
          
          // 注册API
          apiRegistry.register(api);
          
          // 如果配置了API加载后处理函数，则调用它
          if (this.config.afterLoad) {
            this.config.afterLoad(api);
          }
        }
      }
      
      return apis.length;
    } catch (err) {
      console.error(`错误: 加载API文件失败 "${filePath}":`, err);
      return 0;
    }
  }
  
  /**
   * 检查对象是否是API定义
   */
  private isApiDefinition(obj: any): obj is ApiDefinition {
    return obj && 
           typeof obj === 'object' && 
           typeof obj.id === 'string' && 
           typeof obj.handler === 'function';
  }
}

// 创建默认实例
const apiLoader = new ApiLoader();
export default apiLoader; 