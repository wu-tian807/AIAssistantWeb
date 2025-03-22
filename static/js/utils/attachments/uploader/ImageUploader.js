import { ImageAttachment } from '../attachment/ImageAttachment.js';
import { AttachmentType, AttachmentConfig, AttachmentUtils } from '../types.js';
import { showToast } from '../../toast.js';

/**
 * 图片上传器类
 */
export class ImageUploader {
    constructor(options = {}) {
        this.options = options;
        this.uploadUrl = options.uploadUrl || '/upload_image';
        
        // 添加默认值，防止AttachmentConfig未加载完成时出错
        const defaultMaxSize = 1024 * 1024 * 1024; // 1GB
        this.maxSize = options.maxSize || 
            (AttachmentConfig[AttachmentType.IMAGE]?.maxSize || defaultMaxSize);
            
        this.allowedTypes = options.allowedTypes || 
            (AttachmentConfig[AttachmentType.IMAGE]?.allowedExtensions || ['jpg', 'jpeg', 'png', 'gif', 'webp']);
            
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
            
            // 使用AttachmentUtils验证文件类型
            let isValidType = false;
            
            // 通过MIME类型判断
            if (file.type) {
                const typeByMime = AttachmentUtils.getTypeByMimeType(file.type);
                if (typeByMime === AttachmentType.IMAGE) {
                    isValidType = true;
                }
            }
            
            // 通过文件扩展名判断
            if (!isValidType) {
                const extension = '.' + file.name.split('.').pop().toLowerCase();
                const typeByExt = AttachmentUtils.getTypeByExtension(extension);
                if (typeByExt === AttachmentType.IMAGE) {
                    isValidType = true;
                }
            }
            
            if (!isValidType) {
                throw new Error('不支持的图片格式');
            }

            // 验证文件大小
            if (file.size > this.maxSize) {
                const maxSizeMB = this.maxSize / (1024 * 1024);
                throw new Error(`图片文件大小不能超过 ${maxSizeMB}MB`);
            }
            
            // 创建 ImageAttachment 实例
            const imageAttachment = await ImageAttachment.fromFile(file);
            
            // 验证文件
            if (!imageAttachment.isValid()) {
                throw new Error('无效的图片文件');
            }
            
            // 如果需要，进行压缩
            try {
                const compressionResponse = await fetch('/api/user/settings/image_compression');
                if (compressionResponse.ok) {
                    const { image_compression } = await compressionResponse.json();
                    if (image_compression && file.size > 5 * 1024 * 1024) {
                        await imageAttachment.compress();
                    }
                }
            } catch (error) {
                console.error('获取压缩设置失败:', error);
                // 如果获取设置失败，默认不压缩
            }
            
            // 上传到服务器
            await this.uploadImage(imageAttachment);
            
            // 添加到附件集合
            this.attachments.add(imageAttachment);
            
            return imageAttachment;
        } catch (error) {
            console.error('ImageUploader 处理文件失败:', error);
            showToast(error.message, 'error');
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
            if (!imageAttachment || !imageAttachment.file) {
                throw new Error('没有提供图片');
            }

            const formData = new FormData();
            formData.append('image', imageAttachment.file);
            
            // 创建上传进度提示
            const toast = showToast('图片上传中...', 'info', 0);
            const progressText = document.createElement('div');
            progressText.className = 'upload-progress';
            toast.appendChild(progressText);

            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                toast.remove();
                const errorData = await response.json();
                throw new Error(errorData.error || '上传失败');
            }
            
            const data = await response.json();
            
            // 更新附件信息
            imageAttachment.update({
                filePath: data.file_path,
                base64Id: data.base64_id,
                uploadTime: new Date()
            });
            
            toast.remove();
            showToast('图片上传成功', 'success');
            
            this.onSuccess(imageAttachment);
            return imageAttachment;
            
        } catch (error) {
            console.error('图片上传失败:', error);
            showToast(error.message || '图片上传失败', 'error');
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
                fileName: attachment.fileName,
                mimeType: attachment.mime_type,
                filePath: attachment.file_path,
                base64_id: attachment.base64_id,
                type: 'image' // 使用字符串表示类型
            });

            // 添加到附件集合
            this.attachments.add(imageAttachment);

            // 移除创建预览元素的代码，统一由Uploader处理
            
            return imageAttachment;
        } catch (error) {
            console.error('添加已有附件失败:', error);
            throw error;
        }
    }
}

/**
 * 延迟创建单例的辅助类
 */
class ImageUploaderSingleton {
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
            // 确保配置已加载
            await AttachmentUtils.ensureConfigLoaded();
            this._instance = new ImageUploader();
            return this._instance;
        } catch (error) {
            console.error('初始化ImageUploader单例失败:', error);
            // 即使配置加载失败，也返回一个实例，确保系统能继续工作
            this._instance = new ImageUploader();
            return this._instance;
        }
    }
}

// 创建单例管理器
export const imageUploaderSingleton = new ImageUploaderSingleton();

// 为了向后兼容，保留直接导出实例的方式，但这可能在配置未加载时抛出错误
// 推荐使用 imageUploaderSingleton.getInstance() 方法获取实例
export const imageUploader = new ImageUploader();

