import { AttachmentType, AttachmentUtils } from '../types.js';
import { VideoAttachment } from '../attachment/VideoAttachment.js';
import { showToast } from '../../toast.js';

export class VideoUploader {
    constructor(options = {}) {
        this.options = options;
        this.uploadUrl = options.uploadUrl || '/upload_video';
        this.attachments = new Set();
        
        // 添加默认值，防止配置未加载完成时出错
        const defaultMaxSize = 2 * 1024 * 1024 * 1024; // 2GB
        
        try {
            const config = AttachmentUtils.getConfig(AttachmentType.VIDEO);
            this.maxSize = options.maxSize || (config?.maxSize || defaultMaxSize);
        } catch (error) {
            console.warn('加载视频配置失败，使用默认值:', error);
            this.maxSize = options.maxSize || defaultMaxSize;
        }
    }

    /**
     * 处理视频文件选择
     * @param {File} file 视频文件
     * @returns {Promise<VideoAttachment>}
     */
    async handleFileSelect(file) {
        try {
            // 验证文件大小
            if (file.size > this.maxSize) {
                const maxSizeMB = this.maxSize / (1024 * 1024);
                throw new Error(`视频文件大小不能超过 ${maxSizeMB}MB`);
            }

            // 创建视频附件对象
            const videoAttachment = await VideoAttachment.fromFile(file);
            
            // 生成视频缩略图
            await videoAttachment.generateThumbnail();

            // 上传视频文件
            await this.uploadVideo(videoAttachment);

            // 添加到附件集合
            this.attachments.add(videoAttachment);

            return videoAttachment;
        } catch (error) {
            console.error('视频处理失败:', error);
            showToast(error.message, 'error');
            throw error;
        }
    }

    /**
     * 添加已有的视频附件
     * @param {Object} attachment 已有的视频附件数据
     */
    async addExistingAttachment(attachment) {
        try {
            const videoAttachment = new VideoAttachment({
                fileName: attachment.fileName,
                mimeType: attachment.mime_type,
                filePath: attachment.file_path,
                thumbnail: attachment.thumbnail,
                duration: attachment.duration,
                type: 'video' // 使用字符串表示类型
            });

            this.attachments.add(videoAttachment);

            // 移除创建预览元素的代码，统一由Uploader处理
            
            return videoAttachment;
        } catch (error) {
            console.error('添加已有视频附件失败:', error);
            throw error;
        }
    }

    /**
     * 上传视频到服务器
     * @param {VideoAttachment} videoAttachment 
     */
    async uploadVideo(videoAttachment) {
        try {
            const formData = new FormData();
            formData.append('video', videoAttachment.file);
            
            // 如果有缩略图，也一起发送
            if (videoAttachment.thumbnail_base64_id) {
                formData.append('thumbnail_base64_id', videoAttachment.thumbnail_base64_id);
            }
            if (videoAttachment.duration) {
                formData.append('duration', videoAttachment.duration);
            }

            // 创建上传进度提示
            const toast = showToast('视频上传中...', 'info', 0);
            const progressText = document.createElement('div');
            progressText.className = 'upload-progress';
            toast.appendChild(progressText);

            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                toast.remove();
                throw new Error(errorData.error || '上传失败');
            }

            const data = await response.json();
            
            // 更新附件信息
            videoAttachment.update({
                filePath: data.file_path,
                mimeType: data.mime_type,
                uploadTime: new Date()
            });

            toast.remove();
            showToast('视频上传成功', 'success');

            return videoAttachment;

        } catch (error) {
            console.error('视频上传失败:', error);
            throw error;
        }
    }

    getAttachments() {
        return this.attachments;
    }

    clearAttachments() {
        this.attachments.clear();
    }
}

/**
 * 延迟创建单例的辅助类
 */
class VideoUploaderSingleton {
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
            this._instance = new VideoUploader();
            return this._instance;
        } catch (error) {
            console.error('初始化VideoUploader单例失败:', error);
            // 即使配置加载失败，也返回一个实例，确保系统能继续工作
            this._instance = new VideoUploader();
            return this._instance;
        }
    }
}

// 创建单例管理器
export const videoUploaderSingleton = new VideoUploaderSingleton();

// 为了向后兼容，保留直接导出实例的方式，但这可能在配置未加载时抛出错误
// 推荐使用 videoUploaderSingleton.getInstance() 方法获取实例
export const videoUploader = new VideoUploader(); 