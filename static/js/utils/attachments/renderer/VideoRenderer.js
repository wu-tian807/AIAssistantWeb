import { AttachmentType } from '../types.js';
import { VideoModal } from '../modal/VideoModal.js';

export class VideoRenderer {
    /**
     * 渲染视频预览
     * @param {Object} attachment 视频附件对象
     * @returns {Promise<HTMLElement>} 视频预览元素
     */
    async render(attachment) {
        try {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item video-preview-item';
            
            // 创建视频缩略图容器
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'video-thumbnail-container';
            
            // 创建缩略图
            const thumbnail = document.createElement('img');
            thumbnail.className = 'video-thumbnail';
            thumbnail.alt = attachment.filename || '视频';
            
            // 设置默认缩略图
            thumbnail.src = '/static/images/default-thumbnail.png';
            
            // 如果有 thumbnail_base64_id，获取缩略图
            if (attachment.thumbnail_base64_id) {
                try {
                    const response = await fetch(`/api/image/base64/${attachment.thumbnail_base64_id}`);
                    if (!response.ok) {
                        throw new Error(`获取缩略图失败: ${response.status}`);
                    }
                    const data = await response.json();
                    if (data.base64) {
                        thumbnail.src = `data:image/jpeg;base64,${data.base64}`;
                    }
                } catch (error) {
                    console.error('获取缩略图失败:', error);
                }
            } else if (attachment.file_path) {
                // 如果有文件路径但没有缩略图，尝试生成缩略图
                try {
                    const { thumbnail: thumbnailUrl } = await VideoModal.generateThumbnail(
                        `/get_video?path=${encodeURIComponent(attachment.file_path)}`
                    );
                    thumbnail.src = thumbnailUrl;
                    
                    // 保存生成的缩略图
                    const response = await fetch('/api/save_thumbnail', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            thumbnail: thumbnailUrl.split(',')[1],
                        })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        attachment.thumbnail_base64_id = data.base64_id;
                    }
                } catch (error) {
                    console.error('生成缩略图失败:', error);
                }
            }
            
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
        } catch (error) {
            console.error('渲染视频预览失败:', error);
            // 返回一个错误提示元素
            const errorElement = document.createElement('div');
            errorElement.className = 'preview-item video-preview-item error';
            errorElement.textContent = '视频预览加载失败';
            return errorElement;
        }
    }
}

// 导出单例实例
export const videoRenderer = new VideoRenderer(); 