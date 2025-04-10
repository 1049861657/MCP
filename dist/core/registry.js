"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiRegistry = void 0;
const zod_1 = require("zod");
// 为Zod类型添加source方法
if (!zod_1.z.ZodType.prototype.hasOwnProperty('source')) {
    zod_1.z.ZodType.prototype.source = function (source) {
        this._source = source;
        return this;
    };
}
/**
 * API注册中心类 - 负责管理所有API
 */
class ApiRegistry {
    constructor() {
        this.apis = new Map();
    }
    /**
     * 注册单个API
     */
    register(api) {
        if (this.apis.has(api.id)) {
            console.warn(`警告: API '${api.id}' 已存在，将被覆盖。`);
        }
        this.apis.set(api.id, api);
        // 获取模块目录信息（由loader设置）
        let moduleDirectory = api.__moduleDirectory || '';
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
    registerMany(apis) {
        for (const api of apis) {
            this.register(api);
        }
    }
    /**
     * 注销API
     */
    unregister(apiId) {
        const result = this.apis.delete(apiId);
        if (result) {
            console.log(`API '${apiId}' 已注销。`);
        }
        return result;
    }
    /**
     * 获取API定义
     */
    getApi(apiId) {
        return this.apis.get(apiId);
    }
    /**
     * 检查API是否存在
     */
    hasApi(apiId) {
        return this.apis.has(apiId);
    }
    /**
     * 获取所有API的ID列表
     */
    getAllApiIds() {
        return Array.from(this.apis.keys());
    }
    /**
     * 获取所有API的信息
     */
    getAllApiInfo() {
        return Array.from(this.apis.values()).map(api => this.apiDefinitionToInfo(api));
    }
    /**
     * 按分类获取API信息
     */
    getApisByCategory(category) {
        const apis = Array.from(this.apis.values())
            .filter(api => !category || api.category === category)
            .map(api => this.apiDefinitionToInfo(api));
        // 按分类组织
        return apis.reduce((acc, api) => {
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
    getApiInfo(apiId) {
        const api = this.apis.get(apiId);
        if (!api)
            return undefined;
        return this.apiDefinitionToInfo(api);
    }
    /**
     * 执行API
     */
    async executeApi(apiId, params = {}) {
        const api = this.apis.get(apiId);
        if (!api) {
            throw new Error(`API '${apiId}' 不存在。`);
        }
        // 验证必需参数
        const requiredParams = Object.entries(api.schema)
            .filter(([_, schema]) => !schema.isOptional())
            .map(([key]) => key);
        const missingParams = requiredParams.filter(param => !(param in params));
        if (missingParams.length > 0) {
            throw new Error(`缺少必需参数: ${missingParams.join(", ")}`);
        }
        try {
            // 执行API处理器
            return await api.handler(params);
        }
        catch (error) {
            throw new Error(`执行API '${apiId}' 失败: ${error?.message || error}`);
        }
    }
    /**
     * 将API定义转换为API信息
     */
    apiDefinitionToInfo(api) {
        // 提取参数信息
        const parameters = Object.entries(api.schema).map(([name, schema]) => {
            const paramInfo = {
                name,
                type: this.getSchemaType(schema),
                required: !schema.isOptional(),
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
    getSchemaType(schema) {
        // 处理带有默认值的类型
        if (schema instanceof zod_1.z.ZodDefault) {
            // 不在类型中显示默认值，直接返回内部类型
            const innerType = schema.removeDefault();
            return this.getSchemaType(innerType);
        }
        // 处理可选类型
        if (schema instanceof zod_1.z.ZodOptional) {
            const innerType = schema.unwrap();
            // 处理可选且可空的组合类型
            if (innerType instanceof zod_1.z.ZodNullable) {
                return `${this.getSchemaType(innerType.unwrap())}|null?`;
            }
            return `${this.getSchemaType(innerType)}?`;
        }
        // 处理可空类型
        if (schema instanceof zod_1.z.ZodNullable) {
            const innerType = schema.unwrap();
            // 处理可空且可选的组合类型
            if (innerType instanceof zod_1.z.ZodOptional) {
                return `${this.getSchemaType(innerType.unwrap())}|null?`;
            }
            return `${this.getSchemaType(innerType)}|null`;
        }
        // 处理数组类型
        if (schema instanceof zod_1.z.ZodArray) {
            return `${this.getSchemaType(schema.element)}[]`;
        }
        // 处理对象类型
        if (schema instanceof zod_1.z.ZodObject) {
            return 'object';
        }
        // 处理记录类型
        if (schema instanceof zod_1.z.ZodRecord) {
            return 'record';
        }
        // 处理联合类型
        if (schema instanceof zod_1.z.ZodUnion) {
            try {
                // 尝试提取联合类型的选项
                const options = schema._def.options;
                if (Array.isArray(options)) {
                    return options.map(opt => this.getSchemaType(opt)).join('|');
                }
            }
            catch (e) {
                // 如果提取失败，返回一般联合类型
                return 'union';
            }
        }
        // 获取Zod类型的基础类型描述
        const typeName = schema.constructor.name.replace('Zod', '').toLowerCase();
        return typeName;
    }
    /**
     * 获取Zod模式的描述
     */
    getSchemaDescription(schema) {
        // 尝试从模式中获取描述
        const description = schema._def?.description;
        // 处理可选类型
        if (schema instanceof zod_1.z.ZodOptional) {
            const innerDescription = this.getSchemaDescription(schema.unwrap());
            return description || innerDescription || '';
        }
        // 处理可空类型
        if (schema instanceof zod_1.z.ZodNullable) {
            const innerDescription = this.getSchemaDescription(schema.unwrap());
            return description || innerDescription || '';
        }
        return description || '';
    }
    /**
     * 获取Zod模式的默认值
     */
    getSchemaDefault(schema) {
        try {
            // 尝试获取默认值
            if (schema instanceof zod_1.z.ZodDefault) {
                const defaultValue = schema._def?.defaultValue?.();
                return defaultValue !== undefined ? defaultValue : undefined;
            }
            // 处理可选类型
            if (schema instanceof zod_1.z.ZodOptional) {
                return this.getSchemaDefault(schema.unwrap());
            }
            // 处理可空类型
            if (schema instanceof zod_1.z.ZodNullable) {
                return this.getSchemaDefault(schema.unwrap());
            }
        }
        catch (e) {
            // 如果提取失败，返回undefined
            return undefined;
        }
        return undefined;
    }
    /**
     * 获取注册的API数量
     */
    get size() {
        return this.apis.size;
    }
    /**
     * 获取Zod模式的source信息
     */
    getSchemaSource(schema) {
        // 尝试从模式中获取source
        const source = schema._source;
        // 处理可选类型
        if (!source && schema instanceof zod_1.z.ZodOptional) {
            return this.getSchemaSource(schema.unwrap());
        }
        // 处理可空类型
        if (!source && schema instanceof zod_1.z.ZodNullable) {
            return this.getSchemaSource(schema.unwrap());
        }
        // 处理默认值类型
        if (!source && schema instanceof zod_1.z.ZodDefault) {
            return this.getSchemaSource(schema.removeDefault());
        }
        return source;
    }
}
exports.ApiRegistry = ApiRegistry;
// 创建全局API注册表实例
const globalRegistry = new ApiRegistry();
exports.default = globalRegistry;
