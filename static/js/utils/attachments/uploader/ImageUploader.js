import { ImageAttachment } from '../attachment/ImageAttachment.js';
import { AttachmentType, AttachmentConfig } from '../types.js';

/**
 * 图片上传器类
 */
export class ImageUploader {
    constructor(options = {}) {
        this.options = options;
        this.uploadUrl = options.uploadUrl || '/upload_image';
        this.maxSize = options.maxSize || AttachmentConfig[AttachmentType.IMAGE].maxSize;
        this.allowedTypes = options.allowedTypes || AttachmentConfig[AttachmentType.IMAGE].allowedExtensions;
        this.onProgress = options.onProgress || (() => {});
        this.onSuccess = options.onSuccess || (() => {});
        this.onError = options.onError || (() => {});
        this.attachments = new Set();
    }

    /**
     * 创建文件输入元素
     * @returns {HTMLInputElement}
     */
    createFileInput() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.multiple = false;
        return fileInput;
    }

    /**
     * 处理文件选择
     * @param {File} file 
     */
    async handleFileSelect(file) {
        try {
            console.log('ImageUploader 处理文件:', file);
            
            // 创建 ImageAttachment 实例
            const imageAttachment = await ImageAttachment.fromFile(file);
            
            // 验证文件
            if (!imageAttachment.isValid()) {
                throw new Error('无效的图片文件');
            }
            
            // 如果需要，进行压缩
            await imageAttachment.compress();
            
            // 上传到服务器
            await this.uploadImage(imageAttachment);
            
            // 添加到附件集合
            this.attachments.add(imageAttachment);
            
            return imageAttachment;
        } catch (error) {
            console.error('ImageUploader 处理文件失败:', error);
            this.onError(error);
            throw error;
        }
    }

    /**
     * 上传图片
     * @param {ImageAttachment} imageAttachment 
     */
    async uploadImage(imageAttachment) {
        try {
            const formData = imageAttachment.toFormData();
            
            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('上传失败');
            }
            
            const data = await response.json();
            
            // 更新附件信息
            imageAttachment.update({
                filePath: data.file_path,
                uploadTime: new Date()
            });
            
            this.onSuccess(imageAttachment);
            return imageAttachment;
            
        } catch (error) {
            this.onError(error);
            throw error;
        }
    }

    /**
     * 创建预览容器
     * @param {string} containerId - 预览容器的ID
     * @returns {HTMLElement}
     */
    createPreviewContainer(containerId = 'attachment-preview') {
        let container = document.getElementById(containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            container.className = 'attachment-preview';
        }
        return container;
    }

    /**
     * 添加预览图片
     * @param {ImageAttachment} imageAttachment 
     * @param {HTMLElement} container 
     */
    addPreviewImage(imageAttachment, container) {
        if (!container) {
            console.error('预览容器未找到');
            return;
        }
        
        const imageItem = imageAttachment.createUploadPreviewElement(() => {
            try {
                container.removeChild(imageItem);
                this.attachments.delete(imageAttachment);
            } catch (error) {
                console.error('移除预览图片失败:', error);
            }
        });
        
        this.attachments.add(imageAttachment);
        try {
            container.appendChild(imageItem);
        } catch (error) {
            console.error('添加预览图片失败:', error);
            this.attachments.delete(imageAttachment);
        }
    }

    /**
     * 初始化上传功能
     * @param {string} containerId - 预览容器的ID
     */
    init(containerId) {
        const container = this.createPreviewContainer(containerId);
        const fileInput = this.createFileInput();
        
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const imageAttachment = await this.handleFileSelect(file);
                this.addPreviewImage(imageAttachment, container);
            } catch (error) {
                console.error('上传失败:', error);
            }
        };
        
        return {
            container,
            fileInput,
            triggerUpload: () => fileInput.click()
        };
    }

    hasAttachments() {
        return this.attachments.size > 0;
    }
    
    getAttachments() {
        return Array.from(this.attachments);
    }
    
    clearAttachments() {
        this.attachments.clear();
        const container = document.getElementById('attachment-preview');
        if (container) {
            container.innerHTML = '';
        }
    }

    /**
     * 添加已有的附件
     * @param {Object} attachment 已有的附件数据
     * @returns {Promise<ImageAttachment>}
     */
    async addExistingAttachment(attachment) {
        try {
            // 创建新的 ImageAttachment 实例
            const imageAttachment = new ImageAttachment({
                base64Data: attachment.base64,
                fileName: attachment.fileName,
                mimeType: attachment.mime_type,
                filePath: attachment.file_path,
                type: AttachmentType.IMAGE
            });

            // 添加到附件集合
            this.attachments.add(imageAttachment);

            // 如果有容器选项，创建并添加预览元素
            if (this.options?.container) {
                const previewElement = imageAttachment.createUploadPreviewElement(() => {
                    // 从容器中移除预览元素
                    if (previewElement.parentNode) {
                        previewElement.parentNode.removeChild(previewElement);
                    }
                    // 从附件集合中移除
                    this.attachments.delete(imageAttachment);
                    // 调用外部的 onDelete 回调
                    if (this.options.onDelete) {
                        this.options.onDelete(imageAttachment);
                    }
                });
                
                if (previewElement) {
                    this.options.container.appendChild(previewElement);
                }
            }

            return imageAttachment;
        } catch (error) {
            console.error('添加已有附件失败:', error);
            throw error;
        }
    }
}

// 导出单例实例
export const imageUploader = new ImageUploader();
