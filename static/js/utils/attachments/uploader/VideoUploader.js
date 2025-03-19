import { AttachmentType, AttachmentUtils } from '../types.js';
import { VideoAttachment } from '../attachment/VideoAttachment.js';
import { showToast } from '../../toast.js';

export class VideoUploader {
    constructor(options = {}) {
        this.options = options;
        this.uploadUrl = options.uploadUrl || '/upload_video';
        this.attachments = new Set();
        this.maxSize = options.maxSize || AttachmentUtils.getConfig(AttachmentType.VIDEO).maxSize;
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
                duration: attachment.duration
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

// 导出单例实例
export const videoUploader = new VideoUploader(); 