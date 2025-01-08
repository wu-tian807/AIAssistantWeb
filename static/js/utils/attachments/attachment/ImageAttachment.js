import { AttachmentType } from '../types.js';
import { showToast } from '../../toast.js';

/**
 * 图片附件的具体实现
 */
export class ImageAttachment {
    constructor(options = {}) {
        this.type = AttachmentType.IMAGE;
        this.file = options.file || null;
        this.fileName = options.fileName || '';
        this.mime_type = options.mime_type || 'image/jpeg';
        this.filePath = options.filePath || null;
        this.base64Id = options.base64Id || null;
        this.uploadTime = options.uploadTime || null;
        this.previewElement = null;
    }

    /**
     * 从文件创建图片附件
     * @param {File} file 图片文件
     * @returns {Promise<ImageAttachment>}
     */
    static async fromFile(file) {
        if (!file) {
            throw new Error('没有提供文件');
        }

        if (!file.type.startsWith('image/')) {
            throw new Error('不支持的图片格式');
        }

        return new ImageAttachment({
            file: file,
            fileName: file.name,
            mime_type: file.type
        });
    }

    /**
     * 更新附件信息
     * @param {Object} data 更新数据
     */
    update(data) {
        Object.assign(this, data);
    }

    /**
     * 获取文件路径
     * @returns {string|null}
     */
    getFilePath() {
        return this.filePath;
    }

    /**
     * 获取文件名
     * @returns {string}
     */
    getFileName() {
        return this.fileName;
    }

    /**
     * 获取MIME类型
     * @returns {string}
     */
    getMimeType() {
        return this.mime_type;
    }

    /**
     * 获取Base64 ID
     * @returns {string|null}
     */
    getBase64Id() {
        return this.base64Id;
    }

    /**
     * 验证附件是否有效
     * @returns {boolean}
     */
    isValid() {
        return !!(this.file || this.filePath || this.base64Id);
    }

    /**
     * 创建上传预览元素
     * @param {Function} onDelete 删除回调
     * @returns {HTMLElement} 预览元素
     */
    createUploadPreviewElement(onDelete) {
        try {
            const imageItem = document.createElement('div');
            imageItem.className = 'image-preview-item';
            
            const img = document.createElement('img');
            img.className = 'preview-image';
            img.alt = this.fileName;
            
            // 设置预览图片
            if (this.file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    img.src = e.target.result;
                };
                reader.onerror = (e) => {
                    console.error('读取文件失败:', e);
                    img.src = '/static/images/error.png';
                };
                reader.readAsDataURL(this.file);
            } else if (this.base64Id) {
                // 如果有 base64Id，从服务器获取图片
                this.loadImageFromServer(img);
            } else if (this.filePath) {
                img.src = `/get_image?path=${encodeURIComponent(this.filePath)}`;
            } else {
                img.src = '/static/images/error.png';
            }
            
            const fileName = document.createElement('span');
            fileName.textContent = this.fileName;
            fileName.className = 'image-name';
            
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '×';
            deleteButton.className = 'delete-image';
            deleteButton.onclick = (e) => {
                e.stopPropagation();
                if (typeof onDelete === 'function') {
                    onDelete();
                }
            };
            
            imageItem.appendChild(img);
            imageItem.appendChild(fileName);
            imageItem.appendChild(deleteButton);
            
            if (this.filePath) {
                imageItem.setAttribute('data-local-path', this.filePath);
            }
            
            // 保存预览元素的引用
            this.previewElement = imageItem;
            
            return imageItem;
        } catch (error) {
            console.error('创建预览元素失败:', error);
            const errorElement = document.createElement('div');
            errorElement.className = 'preview-item error';
            errorElement.textContent = '预览加载失败';
            return errorElement;
        }
    }

    /**
     * 从服务器加载图片
     * @param {HTMLImageElement} img 图片元素
     */
    async loadImageFromServer(img) {
        try {
            const response = await fetch(`/api/image/base64/${this.base64Id}`);
            if (!response.ok) {
                throw new Error('获取图片失败');
            }
            const data = await response.json();
            if (data.base64) {
                img.src = `data:${this.mime_type};base64,${data.base64}`;
            } else {
                throw new Error('图片数据无效');
            }
        } catch (error) {
            console.error('加载图片失败:', error);
            img.src = '/static/images/error.png';
            showToast('图片加载失败', 'error');
        }
    }
}
