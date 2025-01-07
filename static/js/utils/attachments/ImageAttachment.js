import { AttachmentType } from './AttachmentType.js';
import { AttachmentUtils } from './AttachmentUtils.js';
import { imageUploader } from './uploader/ImageUploader.js';

export class ImageAttachment {
    constructor(options = {}) {
        this.file = options.file;
        this.base64Data = options.base64Data;
        this.fileName = options.fileName || (this.file ? this.file.name : null);
        this.mimeType = options.mimeType || (this.file ? this.file.type : null);
        this.filePath = options.filePath;
        this.type = AttachmentType.IMAGE;
        this.uploadTime = options.uploadTime;
    }

    static async fromFile(file) {
        const base64Data = await AttachmentUtils.fileToBase64(file);
        return new ImageAttachment({
            file,
            base64Data,
            fileName: file.name,
            mimeType: file.type
        });
    }

    isValid() {
        return !!(this.file || this.base64Data);
    }

    async upload() {
        if (!this.isValid()) {
            throw new Error('无效的图片附件');
        }

        try {
            const result = await imageUploader.upload(this.file);
            this.filePath = result.file_path;
            this.uploadTime = new Date();
            return result;
        } catch (error) {
            console.error('图片上传失败:', error);
            throw error;
        }
    }

    toFormData() {
        const formData = new FormData();
        if (this.file) {
            formData.append('image', this.file);
        }
        return formData;
    }

    update(data) {
        Object.assign(this, data);
    }

    createUploadPreviewElement(onDelete) {
        const previewItem = document.createElement('div');
        previewItem.className = 'attachment-preview-item';

        // 创建图片预览
        const img = document.createElement('img');
        img.src = this.base64Data;
        img.alt = this.fileName;
        previewItem.appendChild(img);

        // 创建删除按钮
        const deleteButton = document.createElement('button');
        deleteButton.className = 'attachment-delete-btn';
        deleteButton.innerHTML = '×';
        deleteButton.onclick = () => {
            if (typeof onDelete === 'function') {
                onDelete();
            }
        };
        previewItem.appendChild(deleteButton);

        return previewItem;
    }
} 