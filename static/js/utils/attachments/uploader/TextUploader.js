import { TextAttachment } from '../attachment/TextAttachment.js';

/**
 * 文本文件上传器
 */
export class TextUploader {
    constructor(options = {}) {
        this.options = options;
        this.attachments = new Set();
    }

    /**
     * 处理文件选择
     * @param {File} file - 文件对象
     * @returns {Promise<TextAttachment>}
     */
    async handleFileSelect(file) {
        try {
            // 读取文件内容
            const content = await this.readFileContent(file);
            
            // 发送到服务器
            const response = await fetch('/api/text/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: content,
                    fileName: file.name,
                    encoding: 'UTF-8'  // 默认使用UTF-8编码
                })
            });

            if (!response.ok) {
                throw new Error('上传失败');
            }

            const data = await response.json();
            
            // 创建文本附件实例
            return new TextAttachment({
                fileName: file.name,
                mime_type: file.type || 'text/plain',
                content_id: data.metadata.content_id,
                encoding: data.metadata.encoding,
                lineCount: data.metadata.line_count,
                size: data.metadata.size,
                lastModified: file.lastModified
            });
        } catch (error) {
            console.error('文本文件处理失败:', error);
            throw error;
        }
    }

    /**
     * 读取文件内容
     * @param {File} file - 文件对象
     * @returns {Promise<string>}
     * @private
     */
    async readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    /**
     * 获取所有附件
     * @returns {Set<TextAttachment>}
     */
    getAttachments() {
        return this.attachments;
    }

    /**
     * 清理所有附件
     */
    clearAttachments() {
        this.attachments.clear();
    }

    /**
     * 添加已有的附件
     * @param {Object} attachment - 附件数据
     * @returns {Promise<void>}
     */
    async addExistingAttachment(attachment) {
        const textAttachment = new TextAttachment({
            fileName: attachment.fileName,
            mime_type: attachment.mime_type,
            content_id: attachment.content_id,
            encoding: attachment.encoding,
            lineCount: attachment.lineCount,
            size: attachment.size,
            lastModified: attachment.lastModified,
            description: attachment.description
        });
        this.attachments.add(textAttachment);
    }
}
