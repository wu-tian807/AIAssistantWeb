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
     * @type {number}
     */
    lineCount;

    /**
     * @type {number}
     */
    size;

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
     * @param {number} [params.lineCount] - 文本行数
     * @param {number} [params.size] - 文件大小
     * @param {Date} [params.uploadTime] - 上传时间
     * @param {number} [params.lastModified] - 最后修改时间
     * @param {string} [params.description] - 文件描述
     */
    constructor(params) {
        this.fileName = params.fileName;
        this.mime_type = params.mime_type;
        this.content_id = params.content_id;
        this.encoding = params.encoding || 'UTF-8';
        this.lineCount = params.lineCount;
        this.size = params.size;
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
            lineCount: this.lineCount,
            size: this.size,
            uploadTime: this.uploadTime,
            lastModified: this.lastModified,
            description: this.description
        };
    }

    /**
     * 创建上传预览元素
     * @returns {HTMLElement}
     */
    createUploadPreviewElement() {
        const previewContainer = document.createElement('div');
        previewContainer.className = 'text-attachment-preview upload-preview';

        // 创建文本图标
        const iconContainer = document.createElement('div');
        iconContainer.className = 'text-icon';
        iconContainer.innerHTML = '<i class="fas fa-file-alt"></i>';

        // 创建文件信息容器
        const infoContainer = document.createElement('div');
        infoContainer.className = 'text-info';

        // 添加文件名
        const fileNameElement = document.createElement('div');
        fileNameElement.className = 'file-name';
        fileNameElement.textContent = this.fileName;

        // 添加文件大小和行数信息
        const detailsElement = document.createElement('div');
        detailsElement.className = 'file-details';
        detailsElement.textContent = `${this.formatSize(this.size)} | ${this.lineCount} 行`;

        // 组装元素
        infoContainer.appendChild(fileNameElement);
        infoContainer.appendChild(detailsElement);
        previewContainer.appendChild(iconContainer);
        previewContainer.appendChild(infoContainer);

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