"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_config_1 = require("../../config/api-config");
const zod_1 = require("zod");
const http_utils_1 = require("../../utils/http-utils");
const apiResponseProcessor_1 = require("../../utils/apiResponseProcessor");
const api_config_2 = require("../../config/api-config");
/**
 * 获取设备历史报文API
 * 此API用于查询特定设备的历史报文数据
 */
exports.default = {
    id: "getHistoricalList",
    name: "获取设备历史报文",
    description: "利用通信卡号和设备编号去查询单个设备的历史报文列表",
    category: api_config_1.ApiCategories.HISTORICAL,
    schema: {
        currentPage: zod_1.z.number().optional().describe("当前页码").default(api_config_2.DEFAULT_PAGINATION.CURRENT_PAGE),
        pageRecord: zod_1.z.number().optional().describe("每页记录数").default(api_config_2.DEFAULT_PAGINATION.PAGE_SIZE),
        cardNumberList: zod_1.z.array(zod_1.z.string()).describe("通信卡号列表"),
        deviceCode: zod_1.z.string().describe("设备编号").source("已知卡号->调用数据库工具[SELECT deviceCode FROM tbl_statuslist WHERE cardNumber = '通信卡号';]"),
        type: zod_1.z.string().optional().describe("报文类型").source("调用枚举工具[HistoricalType]"),
        collectionTime: zod_1.z.string().optional().describe("数据采集时间(格式:YYYY-MM-DD)")
    },
    handler: async ({ currentPage, pageRecord, cardNumberList, deviceCode, type, collectionTime }) => {
        try {
            // 保存用户原始设置的分页大小
            const originalPageRecord = pageRecord || api_config_2.DEFAULT_PAGINATION.PAGE_SIZE;
            // 处理日期格式
            let apiCollectionTime = collectionTime;
            let exactDate = null;
            if (collectionTime && collectionTime.match(/^\d{4}-\d{2}-\d{2}$/)) {
                apiCollectionTime = collectionTime.substring(0, 7);
                exactDate = collectionTime;
            }
            const body = {
                currentPage,
                pageRecord: 20000,
                cardNumberList,
                deviceCode,
                type,
                collectionTime: apiCollectionTime // 发送给API的只有年月
            };
            const url = `${api_config_2.BASE_API_URL}/Historical/getList`;
            const rawResponse = await (0, http_utils_1.fetchData)(url, 'POST', body, { 'Cookie': api_config_2.AUTH_COOKIE });
            const processedResponse = (0, apiResponseProcessor_1.processResponse)(rawResponse);
            // 处理响应数据
            if (processedResponse.success && processedResponse.data.length > 0) {
                // 获取原始数据
                let filteredData = [...processedResponse.data];
                // 如果指定了精确日期，筛选匹配的数据
                if (exactDate) {
                    filteredData = filteredData.filter(item => {
                        return item.collectionTime && item.collectionTime.startsWith(exactDate);
                    });
                }
                // 应用用户设置的分页参数
                const startIndex = ((currentPage || 1) - 1) * originalPageRecord;
                const endIndex = startIndex + originalPageRecord;
                const paginatedData = filteredData.slice(startIndex, endIndex);
                // 更新处理后的响应数据
                processedResponse.data = paginatedData;
                // 更新分页信息 (如果是分页响应)
                if ('totalCount' in processedResponse) {
                    processedResponse.totalCount = filteredData.length;
                    processedResponse.currentPage = currentPage || 1;
                    processedResponse.pageSize = originalPageRecord;
                    processedResponse.isAllData = filteredData.length <= originalPageRecord;
                }
            }
            return `获取设备历史报文结果:\n${(0, http_utils_1.handleLargeResponse)(processedResponse, "设备历史报文")}`;
        }
        catch (error) {
            const err = error;
            return `错误: 获取设备历史报文失败 - ${err.message}`;
        }
    },
    examples: [
        {
            description: "获取特定设备的历史报文",
            params: {
                currentPage: 1,
                pageRecord: 15,
                cardNumberList: ["1578961"],
                deviceCode: "010302032200097",
                collectionTime: "2023-02"
            }
        }
    ]
};
