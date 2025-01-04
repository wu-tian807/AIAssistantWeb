export class VideoRenderer {
    /**
     * 渲染视频预览
     * @param {Object} attachment 视频附件对象
     * @returns {HTMLElement} 视频预览元素
     */
    render(attachment) {
        console.log('渲染视频附件:', attachment); // 调试日志
        
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
            this.generateThumbnail(attachment.file_path).then(thumbnailUrl => {
                thumbnail.src = thumbnailUrl;
            }).catch(error => {
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
        duration.textContent = this.formatDuration(attachment.duration || 0);
        
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
        thumbnailContainer.onclick = () => this.openVideoPreview(attachment);
        
        // 组装预览项
        thumbnailContainer.appendChild(thumbnail);
        thumbnailContainer.appendChild(playButton);
        thumbnailContainer.appendChild(duration);
        previewItem.appendChild(thumbnailContainer);
        previewItem.appendChild(fileName);
        
        return previewItem;
    }

    /**
     * 打开视频预览
     * @param {Object} attachment 视频附件对象
     */
    openVideoPreview(attachment) {
        console.log('打开视频预览:', attachment); // 调试日志
        
        const modal = document.createElement('div');
        modal.className = 'video-modal';
        
        const video = document.createElement('video');
        video.controls = true;
        video.className = 'modal-video';
        
        // 设置视频源
        if (attachment.base64) {
            const videoUrl = attachment.base64.startsWith('data:') ? 
                attachment.base64 : 
                `data:${attachment.mime_type};base64,${attachment.base64}`;
            video.src = videoUrl;
        } else if (attachment.file_path) {
            video.src = `/get_video?path=${encodeURIComponent(attachment.file_path)}`;
        }
        
        // 添加加载错误处理
        video.onerror = () => {
            console.error('视频加载失败:', video.error);
            alert('视频加载失败，请重试');
            closeModal();
        };
        
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close-button';
        closeButton.innerHTML = '×';
        
        modal.appendChild(video);
        modal.appendChild(closeButton);
        document.body.appendChild(modal);
        
        // 防止滚动穿透
        document.body.style.overflow = 'hidden';
        
        // 处理关闭事件
        const closeModal = () => {
            video.pause();
            modal.classList.add('modal-closing');
            setTimeout(() => {
                modal.remove();
                document.body.style.overflow = '';
            }, 300);
        };
        
        closeButton.onclick = (e) => {
            e.stopPropagation();
            closeModal();
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };
        
        // ESC键关闭
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        
        // 自动播放
        video.play().catch(error => {
            console.warn('自动播放失败:', error);
            // 自动播放失败是正常的，因为很多浏览器禁止自动播放
        });
    }

    /**
     * 生成视频缩略图
     * @param {string} videoUrl 视频URL
     * @returns {Promise<string>} 缩略图URL
     */
    async generateThumbnail(videoPath) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.src = `/get_video?path=${encodeURIComponent(videoPath)}`;
            video.crossOrigin = 'anonymous';
            
            video.onloadedmetadata = () => {
                video.currentTime = Math.min(1, video.duration / 2);
            };
            
            video.onseeked = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                } catch (error) {
                    reject(error);
                }
            };
            
            video.onerror = reject;
        });
    }

    /**
     * 格式化时长显示
     * @param {number} seconds 秒数
     * @returns {string} 格式化后的时长
     */
    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
} 