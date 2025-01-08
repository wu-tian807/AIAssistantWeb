import { AttachmentType } from '../types.js';
import { VideoModal } from '../modal/VideoModal.js';
import { showToast } from '../../toast.js';

export class VideoAttachment {
    constructor(options = {}) {
        this.type = AttachmentType.VIDEO;
        this.file = options.file || null;
        this.fileName = options.fileName || '';
        this.mime_type = options.mime_type || 'video/mp4';
        this.filePath = options.filePath || null;
        this.thumbnail_base64_id = options.thumbnail_base64_id || null;
        this.duration = options.duration || 0;
        this.previewElement = null;
    }

    /**
     * 从文件创建视频附件
     * @param {File} file 视频文件
     * @returns {Promise<VideoAttachment>}
     */
    static async fromFile(file) {
        if (!file) {
            throw new Error('没有提供文件');
        }

        if (!file.type.startsWith('video/')) {
            throw new Error('不支持的视频格式');
        }

        return new VideoAttachment({
            file: file,
            fileName: file.name,
            mime_type: file.type
        });
    }

    /**
     * 生成视频缩略图
     * @returns {Promise<void>}
     */
    async generateThumbnail() {
        try {
            if (!this.file && !this.filePath) {
                throw new Error('没有可用的视频源');
            }

            let videoUrl;
            if (this.file) {
                videoUrl = URL.createObjectURL(this.file);
            } else if (this.filePath) {
                videoUrl = `/get_video?path=${encodeURIComponent(this.filePath)}`;
            }

            const { thumbnail, duration } = await VideoModal.generateThumbnail(videoUrl);
            
            // 保存缩略图到服务器
            const response = await fetch('/api/save_thumbnail', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    thumbnail: thumbnail.split(',')[1]
                })
            });
            
            if (!response.ok) {
                throw new Error('保存缩略图失败');
            }
            
            const data = await response.json();
            this.thumbnail_base64_id = data.base64_id;
            this.duration = duration;

            if (this.file) {
                URL.revokeObjectURL(videoUrl);
            }
        } catch (error) {
            console.error('生成视频缩略图失败:', error);
            throw error;
        }
    }

    /**
     * 更新附件信息
     * @param {Object} data 更新数据
     */
    update(data) {
        Object.assign(this, data);
    }

    /**
     * 获取文件路径
     * @returns {string|null}
     */
    getFilePath() {
        return this.filePath;
    }

    /**
     * 获取文件名
     * @returns {string}
     */
    getFileName() {
        return this.fileName;
    }

    /**
     * 获取MIME类型
     * @returns {string}
     */
    getMimeType() {
        return this.mime_type;
    }

    /**
     * 获取缩略图Base64 ID
     * @returns {string|null}
     */
    getThumbnailBase64Id() {
        return this.thumbnail_base64_id;
    }

    /**
     * 获取视频时长
     * @returns {number}
     */
    getDuration() {
        return this.duration;
    }

    /**
     * 验证附件是否有效
     * @returns {boolean}
     */
    isValid() {
        return !!(this.file || this.filePath);
    }

    /**
     * 创建上传预览元素
     * @param {Function} onDelete 删除回调
     * @returns {Promise<HTMLElement>} 预览元素
     */
    async createUploadPreviewElement(onDelete) {
        try {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item video-preview-item';
            
            // 创建视频缩略图容器
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'video-thumbnail-container';
            
            // 创建缩略图
            const thumbnail = document.createElement('img');
            thumbnail.className = 'video-thumbnail';
            thumbnail.alt = this.fileName;
            
            // 设置默认缩略图
            thumbnail.src = '/static/images/default-thumbnail.png';
            
            // 如果有缩略图ID，从服务器获取
            if (this.thumbnail_base64_id) {
                await this.loadThumbnailFromServer(thumbnail);
            }
            
            // 创建播放按钮
            const playButton = document.createElement('div');
            playButton.className = 'video-play-button';
            playButton.innerHTML = '▶';
            
            // 创建时长显示
            const duration = document.createElement('div');
            duration.className = 'video-duration';
            duration.textContent = VideoModal.formatDuration(this.duration || 0);
            
            // 创建文件名显示
            const fileName = document.createElement('div');
            fileName.className = 'file-name';
            fileName.textContent = this.fileName;
            
            // 创建删除按钮
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.innerHTML = '×';
            deleteButton.onclick = (e) => {
                e.stopPropagation();
                if (typeof onDelete === 'function') {
                    onDelete();
                }
            };
            
            // 添加点击事件打开视频预览
            thumbnailContainer.onclick = () => {
                let videoUrl;
                if (this.filePath) {
                    videoUrl = `/get_video?path=${encodeURIComponent(this.filePath)}`;
                } else if (this.file) {
                    videoUrl = URL.createObjectURL(this.file);
                }
                
                if (videoUrl) {
                    const modal = VideoModal.createPreviewModal(videoUrl);
                    document.body.appendChild(modal);
                    
                    // 如果使用了 createObjectURL，在模态框关闭时释放
                    if (this.file) {
                        modal.addEventListener('remove', () => {
                            URL.revokeObjectURL(videoUrl);
                        });
                    }
                }
            };
            
            // 组装预览项
            thumbnailContainer.appendChild(thumbnail);
            thumbnailContainer.appendChild(playButton);
            thumbnailContainer.appendChild(duration);
            previewItem.appendChild(thumbnailContainer);
            previewItem.appendChild(fileName);
            previewItem.appendChild(deleteButton);
            
            // 保存预览元素的引用
            this.previewElement = previewItem;
            
            return previewItem;
        } catch (error) {
            console.error('创建预览元素失败:', error);
            const errorElement = document.createElement('div');
            errorElement.className = 'preview-item error';
            errorElement.textContent = '预览加载失败';
            return errorElement;
        }
    }

    /**
     * 从服务器加载缩略图
     * @param {HTMLImageElement} img 图片元素
     */
    async loadThumbnailFromServer(img) {
        try {
            const response = await fetch(`/api/image/base64/${this.thumbnail_base64_id}`);
            if (!response.ok) {
                throw new Error('获取缩略图失败');
            }
            const data = await response.json();
            if (data.base64) {
                img.src = `data:image/jpeg;base64,${data.base64}`;
            } else {
                throw new Error('缩略图数据无效');
            }
        } catch (error) {
            console.error('加载缩略图失败:', error);
            img.src = '/static/images/error.png';
            showToast('缩略图加载失败', 'error');
        }
    }
} 