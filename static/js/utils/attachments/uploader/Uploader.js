import { ImageUploader } from './ImageUploader.js';
import { VideoUploader } from './VideoUploader.js';
import { AttachmentType, AttachmentConfig, MimeTypeMapping, AttachmentUtils } from '../types.js';
import { FileSelector } from '../files/FileSelector.js';
import { createImageModal } from '../modal/imageModal.js';
import { showToast, confirmDialog } from '../../toast.js';

/**
 * 文件类型检测器
 */
class FileTypeDetector {
    static isImage(file) {
        return AttachmentUtils.getTypeByMimeType(file.type) === AttachmentType.IMAGE;
    }

    static isVideo(file) {
        return AttachmentUtils.getTypeByMimeType(file.type) === AttachmentType.VIDEO;
    }

    static isDocument(file) {
        return AttachmentUtils.getTypeByMimeType(file.type) === AttachmentType.DOCUMENT;
    }

    static isDatabase(file) {
        return AttachmentUtils.getTypeByMimeType(file.type) === AttachmentType.DATABASE;
    }

    static isSpreadsheet(file) {
        return AttachmentUtils.getTypeByMimeType(file.type) === AttachmentType.SPREADSHEET;
    }

    static isAudio(file) {
        return AttachmentUtils.getTypeByMimeType(file.type) === AttachmentType.AUDIO;
    }

    static isText(file) {
        return AttachmentUtils.getTypeByMimeType(file.type) === AttachmentType.TEXT;
    }

    static isBinary(file) {
        return AttachmentUtils.getTypeByMimeType(file.type) === AttachmentType.BINARY;
    }

    static detectType(file) {
        // 首先通过 MIME 类型判断
        const typeByMime = AttachmentUtils.getTypeByMimeType(file.type);
        if (typeByMime !== AttachmentType.BINARY) {
            return typeByMime;
        }

        // 如果 MIME 类型无法判断，尝试通过文件扩展名判断
        const extension = file.name.split('.').pop();
        return AttachmentUtils.getTypeByExtension(extension);
    }
}

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
        this.initializeUploaders();
    }

    initializeUploaders() {
        // 初始化各种类型的上传器
        this.uploaders.set(AttachmentType.IMAGE, new ImageUploader({
            ...this.options,
            onDelete: (attachment) => {
                if (this.options.onDelete) {
                    this.options.onDelete(attachment);
                }
            }
        }));
        
        // 添加视频上传器
        this.uploaders.set(AttachmentType.VIDEO, new VideoUploader({
            ...this.options,
            onDelete: (attachment) => {
                if (this.options.onDelete) {
                    this.options.onDelete(attachment);
                }
            }
        }));
        
        // TODO: 后续可以添加其他类型的上传器
        // this.uploaders.set(AttachmentType.DOCUMENT, new DocumentUploader(this.options));
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
        const uploader = this.uploaders.get(attachment.type);
        if (!uploader) {
            throw new Error(`不支持的附件类型: ${attachment.type}`);
        }

        if (uploader.addExistingAttachment) {
            await uploader.addExistingAttachment(attachment);
        } else {
            console.warn(`上传器 ${attachment.type} 不支持添加已有附件`);
        }
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
        const uploader = this.uploaders.get(fileType);

        if (!uploader) {
            showToast(`不支持的文件类型: ${fileType}`, 'error');
            throw new Error(`不支持的文件类型: ${fileType}`);
        }

        try {
            const attachment = await uploader.handleFileSelect(file);
            console.log('文件上传成功，创建预览元素');
            
            // 添加到上传器的附件集合中
            uploader.attachments.add(attachment);
            
            // 调用上传成功的回调
            if (this.options.onUploadSuccess) {
                this.options.onUploadSuccess(attachment);
            }
            
            // 如果有容器选项，创建并添加预览元素
            if (this.options.container) {
                const previewElement = attachment.createUploadPreviewElement(
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
                    // 为预览添加点击事件
                    if (fileType === AttachmentType.IMAGE) {
                        const previewImage = previewElement.querySelector('img');
                        if (previewImage) {
                            previewImage.style.cursor = 'pointer';
                            previewImage.onclick = (e) => {
                                e.stopPropagation();
                                const imageUrl = attachment.getBase64Data() ? 
                                    `data:${attachment.getMimeType()};base64,${attachment.getBase64Data()}` :
                                    attachment.getFilePath();
                                createImageModal(imageUrl);
                            };
                        }
                    }
                    
                    console.log('添加预览元素到容器');
                    this.options.container.appendChild(previewElement);
                }
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
                default:
                    console.warn(`未知的附件类型: ${attachment.type}`);
                    return baseData;
            }
        });
    }
}

// 导出单例实例
export const uploader = new Uploader(); 