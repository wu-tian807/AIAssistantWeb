/**
 * 附件基础结构
 * @typedef {Object} IAttachmentBase
 * @property {string} type - 附件类型
 * @property {string} fileName - 文件名
 * @property {string} [mime_type] - MIME类型
 * @property {string} [filePath] - 文件路径
 * @property {string} [base64] - base64数据
 * @property {number} [size] - 文件大小
 * @property {Date} [uploadTime] - 上传时间
 * @property {number} [lastModified] - 最后修改时间
 * @property {string} [description] - 描述
 */

/**
 * 附件管理器
 * @typedef {Object} IAttachmentManager
 * @property {function(File): Promise<IAttachment>} add - 添加附件
 * @property {function(IAttachment): Promise<void>} remove - 删除附件
 * @property {function(): IAttachment[]} getAll - 获取所有附件
 * @property {function(string): IAttachment[]} getByType - 按类型获取
 * @property {function(string): IAttachment} getById - 按ID获取
 */

/**
 * 附件上传器
 * @typedef {Object} IAttachmentUploader
 * @property {function(IAttachment): Promise<void>} upload - 上传附件
 * @property {function(IAttachment): void} cancel - 取消上传
 * @property {function(IAttachment): number} getProgress - 获取上传进度
 */

// 导出这些类型定义
export const AttachmentInterfaces = {
    // 这个对象在运行时是空的，但通过 JSDoc 提供了类型定义
};