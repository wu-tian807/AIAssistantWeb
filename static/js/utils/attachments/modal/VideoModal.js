/**
 * 视频模态框类
 * 处理视频预览、缩略图生成等功能
 */
export class VideoModal {
    /**
     * 创建视频预览模态框
     * @param {string} videoUrl 视频URL
     * @returns {HTMLElement} 模态框元素
     */
    static createPreviewModal(videoUrl) {
        const modal = document.createElement('div');
        modal.className = 'video-modal';
        
        const video = document.createElement('video');
        video.src = videoUrl;
        video.controls = true;
        video.className = 'modal-video';
        
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close-button';
        closeButton.innerHTML = '×';
        closeButton.onclick = () => {
            modal.classList.add('modal-closing');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.appendChild(video);
        modal.appendChild(closeButton);
        
        // 防止滚动穿透
        document.body.style.overflow = 'hidden';
        modal.addEventListener('remove', () => {
            document.body.style.overflow = '';
        });
        
        // ESC键关闭
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeButton.click();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        
        return modal;
    }

    /**
     * 生成视频缩略图
     * @param {string} videoUrl 视频URL
     * @returns {Promise<{thumbnail: string, duration: number}>} 缩略图数据URL和视频时长
     */
    static async generateThumbnail(videoUrl) {
        return new Promise((resolve, reject) => {
            try {
                const video = document.createElement('video');
                video.src = videoUrl;
                video.crossOrigin = 'anonymous';
                
                video.onloadedmetadata = () => {
                    const duration = video.duration;
                    // 设置视频时间到1秒处以获取更有代表性的缩略图
                    video.currentTime = Math.min(1, duration / 2);
                };
                
                video.onseeked = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        
                        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
                        resolve({
                            thumbnail,
                            duration: video.duration
                        });
                    } catch (error) {
                        reject(error);
                    }
                };
                
                video.onerror = reject;
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 创建缩略图预览元素
     * @param {Object} options 配置选项
     * @param {string} options.thumbnailUrl 缩略图URL
     * @param {string} options.fileName 文件名
     * @param {number} options.duration 视频时长
     * @param {Function} options.onClick 点击回调
     * @param {Function} options.onDelete 删除回调
     * @returns {HTMLElement} 预览元素
     */
    static createThumbnailPreview(options) {
        const {
            thumbnailUrl,
            fileName,
            duration,
            onClick,
            onDelete,
            disableDelete = false
        } = options;

        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item video-preview-item';
        
        // 创建视频缩略图容器
        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.className = 'video-thumbnail-container';
        
        // 创建缩略图
        const thumbnail = document.createElement('img');
        thumbnail.src = thumbnailUrl || '/static/images/default-thumbnail.png';
        thumbnail.alt = fileName;
        thumbnail.className = 'video-thumbnail';
        
        // 创建播放按钮
        const playButton = document.createElement('div');
        playButton.className = 'video-play-button';
        playButton.innerHTML = '▶';
        
        // 创建时长显示
        const durationElement = document.createElement('div');
        durationElement.className = 'video-duration';
        durationElement.textContent = VideoModal.formatDuration(duration || 0);
        
        // 创建文件名显示
        const fileNameElement = document.createElement('div');
        fileNameElement.className = 'file-name';
        fileNameElement.textContent = fileName;
        
        // 只在未禁用删除按钮时创建删除按钮
        if (!disableDelete) {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.innerHTML = '×';
            deleteButton.onclick = (e) => {
                e.stopPropagation();
                if (onDelete) {
                    onDelete();
                }
            };
            previewItem.appendChild(deleteButton);
        }
        
        // 添加点击事件
        if (onClick) {
            thumbnailContainer.onclick = onClick;
            thumbnailContainer.style.cursor = 'pointer';
        }
        
        // 组装预览项
        thumbnailContainer.appendChild(thumbnail);
        thumbnailContainer.appendChild(playButton);
        thumbnailContainer.appendChild(durationElement);
        previewItem.appendChild(thumbnailContainer);
        previewItem.appendChild(fileNameElement);
        
        return previewItem;
    }

    /**
     * 格式化视频时长
     * @param {number} seconds 秒数
     * @returns {string} 格式化后的时长
     */
    static formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
} 