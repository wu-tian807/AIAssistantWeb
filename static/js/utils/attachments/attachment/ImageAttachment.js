import { AttachmentType } from '../types.js';
import { AttachmentConfig } from '../types.js';

/**
 * 图片附件的具体实现
 */
export class ImageAttachment {
    constructor(data) {
        this.type = AttachmentType.IMAGE;
        this.fileName = data.fileName;
        this.mime_type = data.mime_type || 'image/jpeg';
        this.filePath = data.filePath;
        this.base64 = data.base64 || data.base64Data;
        this.size = data.size;
        this.uploadTime = data.uploadTime || new Date();
        this.lastModified = data.lastModified;
        this.description = data.description;
    }

    // 基本操作
    getPreviewUrl() {
        if (this.base64) {
            return `data:${this.mime_type};base64,${this.base64}`;
        }
        return this.filePath || '';
    }

    getDisplayName() {
        return this.fileName;
    }

    getBase64Data() {
        return this.base64;
    }

    setBase64Data(base64) {
        this.base64 = base64;
    }

    getFileName() {
        return this.fileName;
    }

    getMimeType() {
        return this.mime_type;
    }

    getFilePath() {
        return this.filePath;
    }

    setFilePath(path) {
        this.filePath = path;
    }

    getFileSize() {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = this.size;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    getIcon() {
        return AttachmentConfig[AttachmentType.IMAGE].icon;
    }

    // 验证方法
    isValid() {
        return this.validateSize() && this.validateType();
    }

    validateSize() {
        const maxSize = AttachmentConfig[AttachmentType.IMAGE].maxSize;
        return this.size <= maxSize;
    }

    validateType() {
        const allowedExtensions = AttachmentConfig[AttachmentType.IMAGE].allowedExtensions;
        const extension = this.fileName.split('.').pop().toLowerCase();
        return allowedExtensions.includes(extension);
    }

    // 转换方法
    toJSON() {
        return JSON.stringify({
            type: this.type,
            fileName: this.fileName,
            mime_type: this.mime_type,
            filePath: this.filePath,
            base64: this.base64,
            size: this.size,
            uploadTime: this.uploadTime,
            lastModified: this.lastModified,
            description: this.description
        });
    }

    toString() {
        return `Image: ${this.fileName} (${this.getFileSize()})`;
    }

    toFormData() {
        const formData = new FormData();
        if (this.base64) {
            // 将base64转换为Blob
            const byteString = atob(this.base64);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: this.mime_type });
            formData.append('image', blob, this.fileName);
        }
        return formData;
    }

    // 扩展方法
    clone() {
        return new ImageAttachment({...this});
    }

    update(data) {
        Object.assign(this, data);
    }

    // 图片特有方法
    async compress(maxSize = 1024 * 1024) { // 默认压缩到1MB以下
        if (!this.base64 || this.size <= maxSize) return;

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = this.getPreviewUrl();
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // 计算缩放比例
                const ratio = Math.sqrt(maxSize / this.size);
                width *= ratio;
                height *= ratio;
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // 转换为base64，使用较低的质量
                const compressedBase64 = canvas.toDataURL(this.mime_type, 0.7);
                this.base64 = compressedBase64.split(',')[1];
                this.size = Math.round(this.base64.length * 0.75); // 估算压缩后的大小
                
                resolve(this);
            };
            
            img.onerror = reject;
        });
    }

    // 创建预览元素
    createPreviewElement() {
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'message-image-wrapper';
        
        const img = document.createElement('img');
        img.src = this.getPreviewUrl();
        img.alt = this.fileName;
        img.className = 'message-image';
        
        // 使用 ImageModal 进行预览
        img.onclick = () => showImagePreview(this.getPreviewUrl());
        
        imgWrapper.appendChild(img);
        return imgWrapper;
    }

    // 创建上传预览元素
    createUploadPreviewElement(onDelete) {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-preview-item';
        
        const img = document.createElement('img');
        img.src = this.getPreviewUrl();
        img.className = 'preview-image';
        
        const fileName = document.createElement('span');
        fileName.textContent = this.fileName;
        fileName.className = 'image-name';
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'x';
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
    }

    // 静态工厂方法
    static async fromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(new ImageAttachment({
                    fileName: file.name,
                    mime_type: file.type,
                    base64: base64,
                    size: file.size,
                    lastModified: file.lastModified
                }));
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}
