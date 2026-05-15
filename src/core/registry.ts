import { z } from "zod";
import { ApiCategories } from "../config/api-config";

// API分类类型
export type ApiCategory = typeof ApiCategories[keyof typeof ApiCategories];

// API 参数：Zod 4 用 z.core.SomeType 表示任意 schema（经典 API 实例均满足该形状）
export type SchemaDefinition = Record<string, z.core.SomeType>;

/**
 * 进度回调：服务端在长耗时 API 执行期间持续调用，触发客户端 resetTimeoutOnProgress。
 * progress/total 为当前进度分子/分母，message 为可读描述。
 */
export type ProgressCallback = (progress: number, total: number, message?: string) => Promise<void>;

/** API 调用上下文（可选），由 server 层构造后透传给 handler */
export interface ApiContext {
  onProgress?: ProgressCallback;
}

// API处理器类型
export type ApiHandler<T = any> = (params: T, context?: ApiContext) => Promise<string>;

// API定义接口
export interface ApiDefinition {
  id: string;
  name: string;
  description: string;
  category: ApiCategory;
  schema: SchemaDefinition;
  handler: ApiHandler;
  examples?: Array<{
    description: string;
    params: Record<string, any>;
  }>;
}

// API信息接口（不包含处理器，用于返回给客户端）
export interface ApiInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    default?: any;
    source?: string;  // 数据来源信息
  }>;
  examples?: Array<{
    description: string;
    params: Record<string, any>;
  }>;
}

/**
 * API注册中心类 - 负责管理所有API
 */
export class ApiRegistry {
  private apis: Map<string, ApiDefinition> = new Map();
  
  /**
   * 注册单个API
   */
  register(api: ApiDefinition): void {
    if (this.apis.has(api.id)) {
      console.warn(`警告: API '${api.id}' 已存在，将被覆盖。`);
    }
    
    this.apis.set(api.id, api);
    
    // 获取模块目录信息（由loader设置）
    let moduleDirectory = (api as any).__moduleDirectory || '';
    
    // 如果没有从loader获取到目录信息，尝试从调用堆栈推断
    if (!moduleDirectory) {
      const stackTrace = new Error().stack || '';
      const stackLines = stackTrace.split('\n');
      let apiFilePath = 'unknown';
      
      // 查找loadApiFile调用行，它会包含API文件路径
      for (let i = 0; i < stackLines.length; i++) {
        const line = stackLines[i];
        if (line.includes('loadApiFile')) {
          // 尝试从下一行获取文件路径
          const nextLine = stackLines[i + 1] || '';
          const match = nextLine.match(/\((.+?):\d+:\d+\)/);
          if (match && match[1]) {
            apiFilePath = match[1];
            
            // 直接分析文件路径
            const normalizedPath = apiFilePath.replace(/\\/g, '/');
            const apisMatch = normalizedPath.match(/\/apis\/([^/]+)/);
            if (apisMatch && apisMatch[1]) {
              moduleDirectory = apisMatch[1];
            } 
          }
          break;
        }
      }
    }
    
    // 日志格式：API 上级目录-'API ID' 已注册: [分类] 名称
    const dirPrefix = moduleDirectory ? `${moduleDirectory}-` : '';
    console.log(`API ${dirPrefix}'${api.id}' 已注册: [${api.category}] ${api.name}`);
  }
  
  /**
   * 批量注册API
   */
  registerMany(apis: ApiDefinition[]): void {
    for (const api of apis) {
      this.register(api);
    }
  }
  
  /**
   * 注销API
   */
  unregister(apiId: string): boolean {
    const result = this.apis.delete(apiId);
    if (result) {
      console.log(`API '${apiId}' 已注销。`);
    }
    return result;
  }
  
  /**
   * 获取API定义
   */
  getApi(apiId: string): ApiDefinition | undefined {
    return this.apis.get(apiId);
  }
  
  /**
   * 检查API是否存在
   */
  hasApi(apiId: string): boolean {
    return this.apis.has(apiId);
  }
  
  /**
   * 获取所有API的ID列表
   */
  getAllApiIds(): string[] {
    return Array.from(this.apis.keys());
  }
  
  /**
   * 获取所有API的信息
   */
  getAllApiInfo(): ApiInfo[] {
    return Array.from(this.apis.values()).map(api => this.apiDefinitionToInfo(api));
  }
  
  /**
   * 按分类获取API信息
   */
  getApisByCategory(category?: string): Record<string, ApiInfo[]> {
    const apis = Array.from(this.apis.values())
      .filter(api => !category || api.category === category)
      .map(api => this.apiDefinitionToInfo(api));
    
    // 按分类组织
    return apis.reduce<Record<string, ApiInfo[]>>((acc, api) => {
      if (!acc[api.category]) {
        acc[api.category] = [];
      }
      acc[api.category].push(api);
      return acc;
    }, {});
  }
  
  /**
   * 获取特定API的信息
   */
  getApiInfo(apiId: string): ApiInfo | undefined {
    const api = this.apis.get(apiId);
    if (!api) return undefined;
    
    return this.apiDefinitionToInfo(api);
  }
  
  /**
   * 执行API
   * @param onProgress 可选进度回调；由 server 层从 MCP progressToken 构建后传入，
   *                   handler 内部每完成一个子步骤时调用，驱动客户端 resetTimeoutOnProgress。
   */
  async executeApi(
    apiId: string,
    params: Record<string, any> = {},
    onProgress?: ProgressCallback
  ): Promise<string> {
    const api = this.apis.get(apiId);
    if (!api) {
      throw new Error(`API '${apiId}' 不存在。`);
    }
    
    // 验证必需参数
    const requiredParams = Object.entries(api.schema)
      .filter(([_, schema]) => !(schema as z.ZodType).isOptional())
      .map(([key]) => key);
    
    const missingParams = requiredParams.filter(param => !(param in params));
    if (missingParams.length > 0) {
      throw new Error(`缺少必需参数: ${missingParams.join(", ")}`);
    }
    
    try {
      return await api.handler(params, { onProgress });
    } catch (error: any) {
      throw new Error(`执行API '${apiId}' 失败: ${error?.message || error}`);
    }
  }
  
  /**
   * 将API定义转换为API信息
   */
  private apiDefinitionToInfo(api: ApiDefinition): ApiInfo {
    // 提取参数信息
    const parameters = Object.entries(api.schema).map(([name, schema]) => {
      const paramInfo: any = {
        name,
        type: this.getSchemaType(schema),
        required: !(schema as z.ZodType).isOptional(),
        description: this.getSchemaDescription(schema)
      };
      
      // 获取默认值(如果有)
      const defaultValue = this.getSchemaDefault(schema);
      if (defaultValue !== undefined) {
        paramInfo.default = defaultValue;
      }
      
      // 获取source信息(如果有)
      const source = this.getSchemaSource(schema);
      if (source) {
        paramInfo.source = source;
      }
      
      return paramInfo;
    });
    
    return {
      id: api.id,
      name: api.name,
      description: api.description,
      category: api.category,
      parameters,
      examples: api.examples,
    };
  }
  
  /**
   * 获取Zod模式的类型描述
   */
  private getSchemaType(schema: z.core.SomeType): string {
    // 处理带有默认值的类型
    if (schema instanceof z.ZodDefault) {
      const innerType = schema.unwrap();
      return this.getSchemaType(innerType);
    }
    
    // 处理可选类型
    if (schema instanceof z.ZodOptional) {
      const innerType = schema.unwrap();
      
      // 处理可选且可空的组合类型
      if (innerType instanceof z.ZodNullable) {
        return `${this.getSchemaType(innerType.unwrap())}|null?`;
      }
      
      return `${this.getSchemaType(innerType)}?`;
    }
    
    // 处理可空类型
    if (schema instanceof z.ZodNullable) {
      const innerType = schema.unwrap();
      
      // 处理可空且可选的组合类型
      if (innerType instanceof z.ZodOptional) {
        return `${this.getSchemaType(innerType.unwrap())}|null?`;
      }
      
      return `${this.getSchemaType(innerType)}|null`;
    }
    
    // 处理数组类型
    if (schema instanceof z.ZodArray) {
      return `${this.getSchemaType(schema.element)}[]`;
    }
    
    // 处理对象类型
    if (schema instanceof z.ZodObject) {
      return 'object';
    }
    
    // 处理记录类型
    if (schema instanceof z.ZodRecord) {
      return 'record';
    }
    
    // 处理联合类型
    if (schema instanceof z.ZodUnion) {
      const options = schema.options;
      if (Array.isArray(options)) {
        return options.map((opt) => this.getSchemaType(opt)).join("|");
      }
    }
    
    // 获取Zod类型的基础类型描述
    const typeName = schema.constructor.name.replace('Zod', '').toLowerCase();
    return typeName;
  }
  
  /**
   * 获取Zod模式的描述
   */
  private getSchemaDescription(schema: z.core.SomeType): string {
    const reg = z.globalRegistry.get(schema as z.core.$ZodType);
    const regDesc =
      reg && typeof reg === "object" && "description" in reg
        ? (reg as { description?: string }).description
        : undefined;
    const description = (schema as z.ZodType).description ?? regDesc;
    
    // 处理可选类型
    if (schema instanceof z.ZodOptional) {
      const innerDescription = this.getSchemaDescription(schema.unwrap());
      return description || innerDescription || '';
    }
    
    // 处理可空类型
    if (schema instanceof z.ZodNullable) {
      const innerDescription = this.getSchemaDescription(schema.unwrap());
      return description || innerDescription || '';
    }
    
    return description || '';
  }
  
  /**
   * 获取Zod模式的默认值
   */
  private getSchemaDefault(schema: z.core.SomeType): any {
    try {
      if (schema instanceof z.ZodDefault) {
        const raw = (schema as z.ZodDefault).def.defaultValue as unknown;
        const defaultValue =
          typeof raw === "function" ? (raw as () => unknown)() : raw;
        return defaultValue !== undefined ? defaultValue : undefined;
      }
      if (schema instanceof z.ZodPrefault) {
        const raw = (schema as z.ZodPrefault).def.defaultValue as unknown;
        const defaultValue =
          typeof raw === "function" ? (raw as () => unknown)() : raw;
        return defaultValue !== undefined ? defaultValue : undefined;
      }
      
      // 处理可选类型
      if (schema instanceof z.ZodOptional) {
        return this.getSchemaDefault(schema.unwrap());
      }
      
      // 处理可空类型
      if (schema instanceof z.ZodNullable) {
        return this.getSchemaDefault(schema.unwrap());
      }
    } catch (e) {
      // 如果提取失败，返回undefined
      return undefined;
    }
    
    return undefined;
  }
  
  /**
   * 获取注册的API数量
   */
  get size(): number {
    return this.apis.size;
  }

  /**
   * 获取Zod模式的source信息
   */
  private getSchemaSource(schema: z.core.SomeType): string | undefined {
    const reg = z.globalRegistry.get(schema as z.core.$ZodType);
    if (reg && typeof reg === "object" && reg !== null && "source" in reg) {
      const s = (reg as { source?: unknown }).source;
      if (typeof s === "string" && s.length > 0) {
        return s;
      }
    }
    
    if (schema instanceof z.ZodOptional) {
      return this.getSchemaSource(schema.unwrap());
    }

    if (schema instanceof z.ZodNullable) {
      return this.getSchemaSource(schema.unwrap());
    }

    if (schema instanceof z.ZodDefault) {
      return this.getSchemaSource(schema.unwrap());
    }

    if (schema instanceof z.ZodPrefault) {
      return this.getSchemaSource(schema.unwrap());
    }

    return undefined;
  }
}

// 创建全局API注册表实例
const globalRegistry = new ApiRegistry();
export default globalRegistry; 