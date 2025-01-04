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
            // 验证文件类型
            if (!file.type.startsWith('video/')) {
                throw new Error('不支持的视频格式');
            }

            // 验证文件大小
            if (file.size > this.maxSize) {
                const maxSizeMB = this.maxSize / (1024 * 1024);
                throw new Error(`视频文件大小不能超过 ${maxSizeMB}MB`);
            }

            // 创建视频附件对象
            const videoAttachment = await VideoAttachment.fromFile(file);
            
            // 生成视频缩略图
            await videoAttachment.generateThumbnail();

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
                base64: attachment.base64,
                filePath: attachment.file_path,
                thumbnail: attachment.thumbnail,
                duration: attachment.duration
            });

            this.attachments.add(videoAttachment);

            // 如果有容器选项，创建并添加预览元素
            if (this.options.container) {
                const previewElement = videoAttachment.createUploadPreviewElement(
                    // 删除回调
                    () => {
                        // 从容器中移除预览元素
                        if (previewElement.parentNode) {
                            previewElement.parentNode.removeChild(previewElement);
                        }
                        // 从附件集合中移除
                        this.attachments.delete(videoAttachment);
                        // 调用外部的 onDelete 回调
                        if (this.options.onDelete) {
                            this.options.onDelete(videoAttachment);
                        }
                    }
                );
                
                if (previewElement) {
                    console.log('添加视频预览元素到容器');
                    this.options.container.appendChild(previewElement);
                }
            }

            return videoAttachment;
        } catch (error) {
            console.error('添加已有视频附件失败:', error);
            throw error;
        }
    }

    /**
     * 获取所有视频附件
     * @returns {Set<VideoAttachment>}
     */
    getAttachments() {
        return this.attachments;
    }

    /**
     * 清空所有视频附件
     */
    clearAttachments() {
        this.attachments.clear();
    }

    /**
     * 上传视频到服务器
     * @param {VideoAttachment} videoAttachment 
     */
    async uploadVideo(videoAttachment) {
        try {
            const formData = new FormData();
            formData.append('video', videoAttachment.file);

            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('上传失败');
            }

            const data = await response.json();

            // 更新附件信息
            videoAttachment.update({
                filePath: data.file_path,
                mimeType: data.mime_type,
                uploadTime: new Date()
            });

            this.attachments.add(videoAttachment);
            return videoAttachment;

        } catch (error) {
            console.error('视频上传失败:', error);
            throw error;
        }
    }
}

// 导出单例实例
export const videoUploader = new VideoUploader(); 