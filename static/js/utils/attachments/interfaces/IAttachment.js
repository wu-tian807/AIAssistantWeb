/**
 * 附件基础接口
 * @typedef {Object} IAttachmentBase
 * @property {string} type - 附件类型（image/video/audio/document等）
 * @property {string} fileName - 文件名
 * @property {string} mime_type - MIME类型
 * @property {string} [filePath] - 文件在服务器上的路径
 * @property {number} [size] - 文件大小（字节）
 * @property {Date} [uploadTime] - 上传时间
 * @property {number} [lastModified] - 最后修改时间戳
 * @property {string} [description] - 文件描述
 */

/**
 * 图片附件接口
 * @typedef {Object} IImageAttachment
 * @extends {IAttachmentBase}
 * @property {'image'} type - 固定为 'image'
 * @property {string} base64_id - 图片的 base64 数据ID
 * @property {number} [width] - 图片宽度
 * @property {number} [height] - 图片高度
 */

/**
 * 视频附件接口
 * @typedef {Object} IVideoAttachment
 * @extends {IAttachmentBase}
 * @property {'video'} type - 固定为 'video'
 * @property {string} thumbnail_base64_id - 视频缩略图的 base64 数据ID
 * @property {number} duration - 视频时长（秒）
 * @property {number} [width] - 视频宽度
 * @property {number} [height] - 视频高度
 * @property {string} [resolution] - 视频分辨率
 */

/**
 * 文本附件接口
 * @typedef {Object} ITextAttachment
 * @extends {IAttachmentBase}
 * @property {'text'} type - 固定为 'text'
 * @property {string} content_id - 文本内容的唯一标识符
 * @property {string} [encoding] - 文本编码（如 'UTF-8'）
 * @property {number} [lineCount] - 文本行数
 */

/**
 * 附件渲染器接口
 * @typedef {Object} IAttachmentRenderer
 * @property {function(IAttachmentBase): HTMLElement} render - 渲染附件
 * @property {function(): void} clearAll - 清除所有渲染的附件
 * @property {function(HTMLElement): void} setContainer - 设置渲染容器
 */

/**
 * 附件上传器接口
 * @typedef {Object} IAttachmentUploader
 * @property {function(File): Promise<IAttachmentBase>} upload - 上传文件
 * @property {function(IAttachmentBase): void} cancel - 取消上传
 * @property {function(): void} clearAll - 清除所有上传
 * @property {function(): IAttachmentBase[]} getAttachments - 获取所有附件
 * @property {function(IAttachmentBase): Promise<void>} addExistingAttachment - 添加已有附件
 */

/**
 * 附件预览器接口
 * @typedef {Object} IAttachmentPreviewer
 * @property {function(IAttachmentBase): Promise<void>} show - 显示预览
 * @property {function(): void} hide - 隐藏预览
 * @property {function(): void} dispose - 销毁预览器
 */

/**
 * 附件处理器接口
 * @typedef {Object} IAttachmentProcessor
 * @property {function(File): Promise<IAttachmentBase>} process - 处理文件
 * @property {function(IAttachmentBase): Promise<Blob>} compress - 压缩附件
 * @property {function(IAttachmentBase): Promise<string>} generateThumbnail - 生成缩略图
 */

/**
 * 附件存储接口
 * @typedef {Object} IAttachmentStorage
 * @property {function(string): Promise<string>} getBase64 - 获取base64数据
 * @property {function(string): Promise<string>} saveBase64 - 保存base64数据
 * @property {function(string): Promise<void>} deleteBase64 - 删除base64数据
 * @property {function(): Promise<void>} cleanup - 清理过期数据
 */

// 导出接口定义
export const AttachmentInterfaces = {
    // 这个对象在运行时是空的，但通过 JSDoc 提供了类型定义
};