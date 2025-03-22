/**
 * 文本附件类
 */
export class TextAttachment {
    /**
     * @type {'text'}
     */
    type = 'text';

    /**
     * @type {string}
     */
    fileName;

    /**
     * @type {string}
     */
    mime_type;

    /**
     * @type {string}
     */
    content_id;

    /**
     * @type {string}
     */
    encoding;

    /**
     * @type {string}
     */
    contentBase64;

    /**
     * @type {number}
     */
    lineCount;

    /**
     * @type {number}
     */
    size;

    /**
     * @type {string}
     */
    extension;

    /**
     * @type {Date}
     */
    uploadTime;

    /**
     * @type {number}
     */
    lastModified;

    /**
     * @type {string}
     */
    description;

    /**
     * 创建文本附件实例
     * @param {Object} params - 初始化参数
     * @param {string} params.fileName - 文件名
     * @param {string} params.mime_type - MIME类型
     * @param {string} params.content_id - 文本内容唯一标识符
     * @param {string} [params.encoding='UTF-8'] - 文本编码
     * @param {string} [params.contentBase64] - Base64编码的文本内容
     * @param {number} [params.lineCount] - 文本行数
     * @param {number} [params.size] - 文件大小
     * @param {string} [params.extension] - 文件扩展名
     * @param {Date} [params.uploadTime] - 上传时间
     * @param {number} [params.lastModified] - 最后修改时间
     * @param {string} [params.description] - 文件描述
     */
    constructor(params) {
        this.fileName = params.fileName;
        this.mime_type = params.mime_type;
        this.content_id = params.content_id;
        this.encoding = params.encoding || 'UTF-8';
        this.contentBase64 = params.contentBase64;
        this.lineCount = params.lineCount ? Number(params.lineCount) : 0;
        
        // 设置类型
        this.type = params.type || 'text';
        
        // 确保size属性是数字类型
        let fileSize = 0;
        if (params.size !== undefined && params.size !== null) {
            if (typeof params.size === 'number') {
                fileSize = params.size;
            } else {
                // 尝试转换为数字
                fileSize = Number(params.size);
                if (isNaN(fileSize)) {
                    fileSize = parseInt(params.size, 10) || 0;
                }
            }
        }
        this.size = fileSize;
        
        // 设置扩展名，如果没有提供，则从文件名中提取
        if (params.extension) {
            this.extension = params.extension;
        } else if (params.fileName) {
            const extMatch = params.fileName.match(/\.([^.]+)$/);
            this.extension = extMatch ? `.${extMatch[1]}` : '.txt';
        } else {
            this.extension = '.txt';
        }
        
        console.log('TextAttachment构造函数 - 原始size:', params.size, '类型:', typeof params.size, '转换后size:', this.size, '扩展名:', this.extension);
        
        this.uploadTime = params.uploadTime || new Date();
        this.lastModified = params.lastModified;
        this.description = params.description;
    }

    /**
     * 从文件创建文本附件
     * @param {File} file - 文件对象
     * @param {string} content_id - 文本内容唯一标识符
     * @returns {Promise<TextAttachment>}
     */
    static async fromFile(file, content_id) {
        return new TextAttachment({
            fileName: file.name,
            mime_type: file.type || 'text/plain',
            content_id: content_id,
            size: file.size,
            lastModified: file.lastModified
        });
    }

    /**
     * 转换为普通对象
     * @returns {Object}
     */
    toJSON() {
        return {
            type: this.type,
            fileName: this.fileName,
            mime_type: this.mime_type,
            content_id: this.content_id,
            encoding: this.encoding,
            contentBase64: this.contentBase64,
            lineCount: this.lineCount,
            size: this.size,
            extension: this.extension,
            uploadTime: this.uploadTime,
            lastModified: this.lastModified,
            description: this.description
        };
    }

    /**
     * 创建上传预览元素
     * @param {Function} onDelete - 删除回调函数
     * @returns {HTMLElement}
     */
    createUploadPreviewElement(onDelete) {
        const previewContainer = document.createElement('div');
        previewContainer.className = 'text-attachment-preview preview-item';
        previewContainer.dataset.type = 'text';

        // 创建图标容器
        const iconContainer = document.createElement('div');
        iconContainer.className = 'text-icon-container';
        const iconText = document.createElement('div');
        iconText.className = 'text-icon';
        iconText.innerHTML = '📝';
        iconContainer.appendChild(iconText);

        // 创建文件信息容器
        const infoContainer = document.createElement('div');
        infoContainer.className = 'text-info';

        // 添加文件名
        const fileNameElement = document.createElement('div');
        fileNameElement.className = 'file-name';
        fileNameElement.textContent = this.fileName;

        // 添加文件详情（统一显示行数和编码方式）
        const detailsElement = document.createElement('div');
        detailsElement.className = 'file-details';
        detailsElement.textContent = `${this.lineCount || 0} 行 | ${this.encoding || 'UTF-8'}`;

        // 添加删除按钮 - 使用与图片附件一致的className
        if (onDelete) {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button'; // 统一使用delete-button类名
            deleteButton.textContent = '×';
            deleteButton.onclick = (e) => {
                e.stopPropagation();
                onDelete();
            };
            previewContainer.appendChild(deleteButton);
        }

        // 保存关键信息到元素数据属性
        previewContainer.dataset.contentId = this.content_id;
        previewContainer.dataset.fileName = this.fileName;
        previewContainer.dataset.mimeType = this.mime_type;
        previewContainer.dataset.encoding = this.encoding || 'UTF-8';
        previewContainer.dataset.lineCount = this.lineCount || '0';
        previewContainer.dataset.extension = this.extension || '.txt';
        previewContainer.dataset.size = this.size || '0';

        // 组装元素
        infoContainer.appendChild(fileNameElement);
        infoContainer.appendChild(detailsElement);
        previewContainer.appendChild(iconContainer);
        previewContainer.appendChild(infoContainer);

        // 添加点击事件，打开预览模态框
        previewContainer.onclick = () => {
            // 导入并创建模态框
            import('../modal/TextModal.js').then(({ TextModal }) => {
                const modal = new TextModal();
                
                // 创建完整的附件对象进行预览
                const previewAttachment = {
                    ...this,
                    // 强制将所有需要的属性复制一遍，避免丢失
                    fileName: this.fileName,
                    mime_type: this.mime_type,
                    content_id: this.content_id,
                    encoding: this.encoding || 'UTF-8',
                    contentBase64: this.contentBase64,
                    lineCount: this.lineCount || 0,
                    size: this.size || 0,
                    extension: this.extension || '.txt'
                };
                
                modal.show(previewAttachment);
            }).catch(error => {
                console.error('加载预览模态框失败:', error);
                previewContainer.classList.add('error');
                detailsElement.textContent = '加载预览失败';
                detailsElement.classList.add('error');
            });
        };

        return previewContainer;
    }

    /**
     * 格式化文件大小
     * @param {number} bytes
     * @returns {string}
     */
    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
     * 获取文件路径
     * @returns {string}
     */
    getFilePath() {
        return this.content_id;
    }
}    