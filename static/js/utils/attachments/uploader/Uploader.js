import { ImageUploader } from './ImageUploader.js';
import { VideoUploader } from './VideoUploader.js';
import { TextUploader } from './TextUploader.js';
import { AttachmentType, AttachmentConfig, MimeTypeMapping, AttachmentUtils } from '../types.js';
import { FileSelector } from '../files/FileSelector.js';
import { createImageModal } from '../modal/imageModal.js';
import { showToast, confirmDialog } from '../../toast.js';
import { FileTypeDetector } from './FileTypeDetector.js';

/**
 * 统一的上传处理器
 */
export class Uploader {
    constructor(options = {}) {
        this.options = options;
        this.uploaders = new Map();
        this.fileSelector = new FileSelector({
            multiple: true,
            accept: '*/*',
            onFileSelected: async (files) => {
                if (!Array.isArray(files)) {
                    files = [files];
                }
                for (const file of files) {
                    try {
                        await this.upload(file);
                    } catch (error) {
                        console.error('文件上传失败:', error);
                    }
                }
            }
        });
        
        // 检查是否需要自动初始化
        if (options.autoInitialize !== false) {
            // 延迟初始化，确保DOM已准备好且配置已加载
            setTimeout(async () => {
                try {
                    await this.initialize();
                } catch (error) {
                    console.error('上传器自动初始化失败:', error);
                }
            }, 0);
        }
    }

    /**
     * 初始化上传器
     * 确保所有配置都已加载完成
     */
    async initialize() {
        try {
            // 确保配置已加载
            await AttachmentUtils.ensureConfigLoaded();
            this.initializeUploaders();
            return true;
        } catch (error) {
            console.error('初始化上传器失败:', error);
            // 即使配置加载失败，也尝试初始化上传器，使用默认值
            this.initializeUploaders();
            return false;
        }
    }

    initializeUploaders() {
        // 初始化各种类型的上传器
        // 使用字符串键，方便后续查找
        this.uploaders.set('image', new ImageUploader({
            ...this.options,
            onDelete: (attachment) => {
                if (this.options.onDelete) {
                    this.options.onDelete(attachment);
                }
            }
        }));
        
        // 添加视频上传器
        this.uploaders.set('video', new VideoUploader({
            ...this.options,
            onDelete: (attachment) => {
                if (this.options.onDelete) {
                    this.options.onDelete(attachment);
                }
            }
        }));

        // 添加文本上传器
        this.uploaders.set('text', new TextUploader({
            ...this.options,
            onDelete: (attachment) => {
                if (this.options.onDelete) {
                    this.options.onDelete(attachment);
                }
            }
        }));
        
        // 同时为了保持与旧代码的兼容性，也添加枚举类型的映射
        this.uploaders.set(AttachmentType.IMAGE, this.uploaders.get('image'));
        this.uploaders.set(AttachmentType.VIDEO, this.uploaders.get('video'));
        this.uploaders.set(AttachmentType.TEXT, this.uploaders.get('text'));
        
        console.log('初始化完成的上传器:', [...this.uploaders.keys()]);
    }

    /**
     * 获取所有附件
     * @returns {Array} 所有上传器中的附件列表
     */
    getAttachments() {
        let allAttachments = [];
        for (const uploader of this.uploaders.values()) {
            if (uploader.getAttachments) {
                allAttachments = allAttachments.concat(Array.from(uploader.getAttachments()));
            }
        }
        return allAttachments;
    }

    /**
     * 移除指定附件
     * @param {Object} attachment 要移除的附件
     */
    removeAttachment(attachment) {
        const uploader = this.uploaders.get(attachment.type);
        if (uploader && uploader.attachments) {
            uploader.attachments.delete(attachment);
        }
    }

    /**
     * 添加已有的附件
     * @param {Object} attachment 已有的附件数据
     */
    async addExistingAttachment(attachment) {
        console.log('添加已有附件:', attachment);
        
        // 获取正确的上传器，兼容后端返回的字符串类型和枚举类型
        let uploader;
        if (typeof attachment.type === 'string') {
            // 后端返回的类型是字符串，需要找到对应的上传器
            const typeName = attachment.type.toLowerCase();
            // 尝试找到匹配的上传器
            for (const [key, value] of this.uploaders.entries()) {
                if (key.toLowerCase() === typeName) {
                    uploader = value;
                    break;
                }
            }
            
            // 如果找不到对应的上传器，尝试直接使用类型名称
            if (!uploader) {
                uploader = this.uploaders.get(typeName);
            }
        } else {
            // 如果类型不是字符串，直接查找
            uploader = this.uploaders.get(attachment.type);
        }

        if (!uploader) {
            console.error(`找不到类型为 "${attachment.type}" 的上传器`);
            throw new Error(`不支持的附件类型: ${attachment.type}`);
        }

        let addedAttachment;
        if (uploader.addExistingAttachment) {
            addedAttachment = await uploader.addExistingAttachment(attachment);
            console.log('添加已有附件成功:', addedAttachment);
            
            // 为所有类型的附件统一创建预览元素
            if (this.options.container && addedAttachment) {
                if (typeof addedAttachment.createUploadPreviewElement === 'function') {
                    try {
                        console.log(`开始为已有${attachment.type}附件创建预览元素`);
                        const previewElement = await addedAttachment.createUploadPreviewElement(
                            // 删除回调
                            () => {
                                // 从容器中移除预览元素
                                if (previewElement.parentNode) {
                                    previewElement.parentNode.removeChild(previewElement);
                                }
                                // 从附件集合中移除
                                uploader.attachments.delete(addedAttachment);
                                // 调用外部的 onDelete 回调
                                if (this.options.onDelete) {
                                    this.options.onDelete(addedAttachment);
                                }
                            }
                        );
                        
                        if (previewElement) {
                            console.log('已有附件预览元素创建成功:', previewElement);
                            this.options.container.appendChild(previewElement);
                        } else {
                            console.error('已有附件预览元素创建失败');
                        }
                    } catch (error) {
                        console.error('创建已有附件预览元素时出错:', error);
                    }
                } else {
                    console.error('附件对象缺少createUploadPreviewElement方法:', addedAttachment);
                }
            }
        } else {
            console.warn(`上传器 ${attachment.type} 不支持添加已有附件`);
        }
        
        return addedAttachment;
    }

    /**
     * 打开文件选择对话框
     */
    selectFiles() {
        console.log('触发文件选择...'); // 调试日志
        if (!this.fileSelector) {
            console.error('FileSelector 未初始化');
            return;
        }
        this.fileSelector.select().catch(error => {
            console.error('文件选择失败:', error);
        });
    }

    /**
     * 处理文件上传
     * @param {File|Blob} file - 要上传的文件
     * @param {Object} options - 上传选项
     * @returns {Promise} 上传结果
     */
    async upload(file, options = {}) {
        console.log('开始上传文件:', file); // 调试日志
        const fileType = FileTypeDetector.detectType(file);
        console.log('检测到文件类型:', fileType);
        
        // 获取对应的上传器，兼容字符串和枚举类型
        let uploader;
        if (typeof fileType === 'string') {
            uploader = this.uploaders.get(fileType.toLowerCase());
        } else {
            uploader = this.uploaders.get(fileType);
        }

        if (!uploader) {
            console.error(`找不到类型为 "${fileType}" 的上传器，可用类型:`, [...this.uploaders.keys()]);
            showToast(`不支持的文件类型: ${fileType}`, 'error');
            throw new Error(`不支持的文件类型: ${fileType}`);
        }

        try {
            console.log(`使用 ${fileType} 上传器处理文件`);
            const attachment = await uploader.handleFileSelect(file);
            console.log('文件上传成功，创建预览元素', attachment);
            
            // 如果有容器选项，创建并添加预览元素
            if (this.options.container) {
                // 检查附件对象是否有createUploadPreviewElement方法
                if (typeof attachment.createUploadPreviewElement !== 'function') {
                    console.error('附件对象缺少createUploadPreviewElement方法:', attachment);
                    throw new Error(`${fileType}附件缺少必要的createUploadPreviewElement方法`);
                }
                
                const previewElement = await attachment.createUploadPreviewElement(
                    // 删除回调
                    () => {
                        // 从容器中移除预览元素
                        if (previewElement.parentNode) {
                            previewElement.parentNode.removeChild(previewElement);
                        }
                        // 从附件集合中移除
                        uploader.attachments.delete(attachment);
                        // 调用外部的 onDelete 回调
                        if (this.options.onDelete) {
                            this.options.onDelete(attachment);
                        }
                    }
                );

                if (previewElement) {
                    console.log('预览元素创建成功:', previewElement);
                    
                    // 为预览添加点击事件
                    if (fileType === AttachmentType.IMAGE) {
                        const previewImage = previewElement.querySelector('img');
                        if (previewImage) {
                            previewImage.style.cursor = 'pointer';
                            previewImage.onclick = (e) => {
                                e.stopPropagation();
                                // 使用文件路径获取图片
                                const imageUrl = `/get_image?path=${encodeURIComponent(attachment.getFilePath())}`;
                                createImageModal(imageUrl);
                            };
                        }
                    }
                    
                    // 确保删除按钮有正确的事件处理
                    const deleteButton = previewElement.querySelector('.delete-button');
                    if (deleteButton && !deleteButton.onclick) {
                        deleteButton.onclick = (e) => {
                            e.stopPropagation();
                            // 从容器中移除预览元素
                            if (previewElement.parentNode) {
                                previewElement.parentNode.removeChild(previewElement);
                            }
                            // 从附件集合中移除
                            uploader.attachments.delete(attachment);
                            // 调用外部的 onDelete 回调
                            if (this.options.onDelete) {
                                this.options.onDelete(attachment);
                            }
                        };
                    }
                    
                    // 如果有自定义预览处理器，使用预览处理器处理预览元素
                    if (this.options.previewHandler && typeof this.options.previewHandler === 'function') {
                        const handled = await this.options.previewHandler(previewElement);
                        // 如果预览处理器返回true，表示已处理，不需要再添加到容器
                        if (handled === true) {
                            console.log('预览元素已由自定义处理器处理');
                        } else {
                            // 否则，仍然使用默认方式添加到容器
                            console.log('添加预览元素到容器（默认方式）');
                            this.options.container.appendChild(previewElement);
                        }
                    } else {
                        // 没有自定义处理器，使用默认方式添加到容器
                        console.log('添加预览元素到容器（默认方式）');
                        this.options.container.appendChild(previewElement);
                    }
                }
            }

            // 调用上传成功的回调
            if (this.options.onUploadSuccess) {
                this.options.onUploadSuccess(attachment);
            }

            return attachment;
        } catch (error) {
            console.error('文件上传处理失败:', error);
            throw error;
        }
    }

    /**
     * 处理粘贴事件
     * @param {ClipboardEvent} event 
     */
    async handlePaste(event) {
        const items = Array.from(event.clipboardData.items);
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    await this.upload(file);
                }
            }
        }
    }

    /**
     * 处理拖放事件
     * @param {DragEvent} event 
     */
    async handleDrop(event) {
        const files = Array.from(event.dataTransfer.files);
        for (const file of files) {
            await this.upload(file);
        }
    }

    /**
     * 获取指定类型的上传器
     * @param {AttachmentType} type 
     * @returns {Object} 上传器实例
     */
    getUploader(type) {
        return this.uploaders.get(type);
    }

    /**
     * 清理所有上传器的附件
     */
    clearAll() {
        for (const uploader of this.uploaders.values()) {
            uploader.clearAttachments?.();
        }
    }

    /**
     * 收集所有附件的数据用于发送
     * @returns {Array} 附件数据数组
     */
    collectAttachments() {
        const attachments = this.getAttachments();
        return attachments.map(attachment => {
            const baseData = {
                type: attachment.type,
                fileName: attachment.getFileName(),
                mime_type: attachment.getMimeType(),
                file_path: attachment.getFilePath()
            };

            // 根据不同类型的附件获取特定的数据
            switch (attachment.type) {
                case AttachmentType.IMAGE:
                    return {
                        ...baseData,
                        base64_id: attachment.getBase64Id()
                    };
                case AttachmentType.VIDEO:
                    return {
                        ...baseData,
                        duration: attachment.getDuration(),
                        thumbnail_base64_id: attachment.getThumbnailBase64Id()
                    };
                case AttachmentType.TEXT:
                    return {
                        ...baseData,
                        content_id: attachment.content_id,
                        encoding: attachment.encoding,
                        lineCount: attachment.lineCount
                    };
                default:
                    console.warn(`未知的附件类型: ${attachment.type}`);
                    return baseData;
            }
        });
    }
}

/**
 * 延迟创建单例的辅助类
 */
class UploaderSingleton {
    constructor() {
        this._instance = null;
        this._initPromise = null;
    }

    async getInstance() {
        if (this._instance) {
            return this._instance;
        }

        if (!this._initPromise) {
            this._initPromise = this._initialize();
        }

        return await this._initPromise;
    }

    async _initialize() {
        try {
            // 创建实例并确保配置已加载
            const instance = new Uploader({
                autoInitialize: false // 禁止自动初始化
            });
            
            // 手动初始化
            await instance.initialize();
            
            this._instance = instance;
            return this._instance;
        } catch (error) {
            console.error('初始化Uploader单例失败:', error);
            // 即使配置加载失败，也返回一个实例，确保系统能继续工作
            this._instance = new Uploader({
                autoInitialize: false
            });
            // 尝试初始化
            await this._instance.initialize();
            return this._instance;
        }
    }
}

// 创建单例管理器
export const uploaderSingleton = new UploaderSingleton();

// 为了向后兼容，保留直接导出实例的方式，但这可能在配置未加载时抛出错误
// 推荐使用 uploaderSingleton.getInstance() 方法获取实例
export const uploader = new Uploader(); 