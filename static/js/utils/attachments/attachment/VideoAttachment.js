import { AttachmentType } from '../types.js';
import { VideoModal } from '../modal/VideoModal.js';
import { videoUploader } from '../uploader/VideoUploader.js';

export class VideoAttachment {
    constructor(options = {}) {
        this.type = AttachmentType.VIDEO;
        this.fileName = options.fileName || '';
        this.mimeType = options.mimeType || 'video/mp4';
        this.base64 = options.base64 || null;
        this.filePath = options.filePath || null;
        this.thumbnail = options.thumbnail || null;
        this.duration = options.duration || 0;
        this.file = options.file || null;
    }

    /**
     * 从文件创建视频附件
     * @param {File} file 视频文件
     * @returns {Promise<VideoAttachment>}
     */
    static async fromFile(file) {
        return new Promise((resolve, reject) => {
            try {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const base64 = e.target.result.split(',')[1];
                    const attachment = new VideoAttachment({
                        fileName: file.name,
                        mimeType: file.type,
                        base64: base64,
                        file: file
                    });
                    
                    try {
                        // 上传视频文件
                        await videoUploader.uploadVideo(attachment);
                        resolve(attachment);
                    } catch (error) {
                        reject(error);
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 生成视频缩略图
     * @returns {Promise<void>}
     */
    async generateThumbnail() {
        try {
            const { thumbnail, duration } = await VideoModal.generateThumbnail(this.getUrl());
            this.thumbnail = thumbnail;
            this.duration = duration;
        } catch (error) {
            console.error('生成视频缩略图失败:', error);
            throw error;
        }
    }

    /**
     * 获取视频URL
     * @returns {string}
     */
    getUrl() {
        if (this.base64) {
            return `data:${this.mimeType};base64,${this.base64}`;
        } else if (this.filePath) {
            return `/get_video?path=${encodeURIComponent(this.filePath)}`;
        }
        return '';
    }

    /**
     * 获取视频缩略图URL
     * @returns {string}
     */
    getThumbnailUrl() {
        if (this.thumbnail) {
            if (this.thumbnail.startsWith('data:')) {
                return this.thumbnail;
            } else {
                return `data:image/jpeg;base64,${this.thumbnail}`;
            }
        }
        return '/static/images/default-thumbnail.png';
    }

    /**
     * 创建上传预览元素
     * @param {Function} onDelete 删除回调
     * @returns {HTMLElement}
     */
    createUploadPreviewElement(onDelete) {
        const element = VideoModal.createThumbnailPreview({
            thumbnailUrl: this.getThumbnailUrl(),
            fileName: this.fileName,
            duration: this.duration,
            onClick: () => this.openVideoPreview(),
            onDelete
        });
        
        // 添加上传中的状态
        element.classList.add('uploading');
        
        // 监听上传完成事件
        const checkUploadStatus = setInterval(() => {
            if (this.filePath) {
                element.classList.remove('uploading');
                clearInterval(checkUploadStatus);
            }
        }, 500);
        
        return element;
    }

    /**
     * 创建消息预览元素
     * @returns {HTMLElement}
     */
    createMessagePreviewElement() {
        return VideoModal.createThumbnailPreview({
            thumbnailUrl: this.getThumbnailUrl(),
            fileName: this.fileName,
            duration: this.duration,
            onClick: () => this.openVideoPreview(),
            disableDelete: true
        });
    }

    /**
     * 打开视频预览
     */
    openVideoPreview() {
        const modal = VideoModal.createPreviewModal(this.getUrl());
        document.body.appendChild(modal);
    }

    getFileName(){
        return this.fileName;
    }

    getMimeType(){
        return this.mimeType;
    }
    getFilePath(){
        return this.filePath;
    }
    getBase64Data(){
        return this.base64;
    }

    getDuration() {
        return this.duration;
    }

    getThumbnail() {
        return this.thumbnail;
    }

    /**
     * 更新附件信息
     * @param {Object} data 更新的数据
     */
    update(data) {
        if (data.filePath !== undefined) {
            this.filePath = data.filePath;
        }
        if (data.base64 !== undefined) {
            this.base64 = data.base64;
        }
        if (data.fileName !== undefined) {
            this.fileName = data.fileName;
        }
        if (data.mimeType !== undefined) {
            this.mimeType = data.mimeType;
        }
        if (data.thumbnail !== undefined) {
            this.thumbnail = data.thumbnail;
        }
        if (data.duration !== undefined) {
            this.duration = data.duration;
        }
    }
} 