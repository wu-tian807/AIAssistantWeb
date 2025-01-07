import { AttachmentType } from '../types.js';
import { VideoModal } from '../modal/VideoModal.js';

export class VideoRenderer {
    /**
     * 渲染视频预览
     * @param {Object} attachment 视频附件对象
     * @returns {HTMLElement} 视频预览元素
     */
    render(attachment) {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item video-preview-item';
        
        // 创建视频缩略图容器
        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.className = 'video-thumbnail-container';
        
        // 创建缩略图
        const thumbnail = document.createElement('img');
        if (attachment.thumbnail) {
            // 处理不同格式的缩略图数据
            if (attachment.thumbnail.startsWith('data:')) {
                thumbnail.src = attachment.thumbnail;
            } else {
                thumbnail.src = `data:image/jpeg;base64,${attachment.thumbnail}`;
            }
        } else if (attachment.file_path) {
            // 如果有文件路径但没有缩略图，尝试生成缩略图
            VideoModal.generateThumbnail(attachment.file_path)
                .then(({thumbnail: thumbnailUrl}) => {
                    thumbnail.src = thumbnailUrl;
                })
                .catch(error => {
                    console.error('生成缩略图失败:', error);
                    thumbnail.src = '/static/images/default-thumbnail.png';
                });
        } else {
            thumbnail.src = '/static/images/default-thumbnail.png';
        }
        thumbnail.alt = attachment.filename || '视频';
        thumbnail.className = 'video-thumbnail';
        
        // 创建播放按钮
        const playButton = document.createElement('div');
        playButton.className = 'video-play-button';
        playButton.innerHTML = '▶';
        
        // 创建时长显示
        const duration = document.createElement('div');
        duration.className = 'video-duration';
        duration.textContent = VideoModal.formatDuration(attachment.duration || 0);
        
        // 创建文件名显示
        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = attachment.filename || '未命名视频';
        
        // 设置删除按钮的显示状态
        previewItem.setAttribute('data-disable-delete', attachment.disableDelete ? 'true' : 'false');
        
        // 只在未禁用删除按钮时创建删除按钮
        if (!attachment.disableDelete) {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.innerHTML = '×';
            deleteButton.onclick = (e) => {
                e.stopPropagation();
                if (typeof attachment.onDelete === 'function') {
                    attachment.onDelete();
                }
                previewItem.remove();
            };
            previewItem.appendChild(deleteButton);
        }
        
        // 添加点击事件打开视频预览
        thumbnailContainer.onclick = () => {
            let videoUrl;
            if (attachment.file_path) {
                videoUrl = `/get_video?path=${encodeURIComponent(attachment.file_path)}`;
            } else if (attachment.base64) {
                videoUrl = attachment.base64.startsWith('data:') ? 
                    attachment.base64 : 
                    `data:${attachment.mime_type || 'video/mp4'};base64,${attachment.base64}`;
            }
            
            if (videoUrl) {
                const modal = VideoModal.createPreviewModal(videoUrl);
                document.body.appendChild(modal);
            }
        };
        
        // 组装预览项
        thumbnailContainer.appendChild(thumbnail);
        thumbnailContainer.appendChild(playButton);
        thumbnailContainer.appendChild(duration);
        previewItem.appendChild(thumbnailContainer);
        previewItem.appendChild(fileName);
        
        return previewItem;
    }
}

// 导出单例实例
export const videoRenderer = new VideoRenderer(); 