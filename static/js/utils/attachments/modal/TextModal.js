/**
 * 文本预览模态框
 */
export class TextModal {
    /**
     * @type {HTMLElement}
     * @private
     */
    modalElement;

    /**
     * @type {HTMLElement}
     * @private
     */
    contentElement;

    /**
     * @type {TextAttachment}
     * @private
     */
    currentAttachment;

    /**
     * 创建文本预览模态框
     */
    constructor() {
        this.createModal();
        this.bindEvents();
    }

    /**
     * 创建模态框DOM结构
     * @private
     */
    createModal() {
        // 创建模态框容器
        this.modalElement = document.createElement('div');
        this.modalElement.className = 'text-preview-modal modal fade';
        this.modalElement.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">文本预览</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="text-info mb-3">
                            <div class="row">
                                <div class="col-md-6">
                                    <p><strong>文件名：</strong><span class="file-name"></span></p>
                                    <p><strong>大小：</strong><span class="file-size"></span></p>
                                </div>
                                <div class="col-md-6">
                                    <p><strong>行数：</strong><span class="line-count"></span></p>
                                    <p><strong>编码：</strong><span class="encoding"></span></p>
                                </div>
                            </div>
                        </div>
                        <div class="text-content">
                            <pre><code></code></pre>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                    </div>
                </div>
            </div>
        `;

        // 获取内容元素引用
        this.contentElement = this.modalElement.querySelector('.text-content code');
        
        // 添加到文档
        document.body.appendChild(this.modalElement);
    }

    /**
     * 绑定事件
     * @private
     */
    bindEvents() {
        // 模态框关闭时清理
        this.modalElement.addEventListener('hidden.bs.modal', () => {
            this.currentAttachment = null;
            this.contentElement.textContent = '';
        });
    }

    /**
     * 显示文本预览
     * @param {TextAttachment} attachment - 文本附件对象
     * @returns {Promise<void>}
     */
    async show(attachment) {
        this.currentAttachment = attachment;

        // 更新文件信息
        this.modalElement.querySelector('.file-name').textContent = attachment.fileName;
        this.modalElement.querySelector('.file-size').textContent = this.formatFileSize(attachment.size);
        this.modalElement.querySelector('.line-count').textContent = attachment.lineCount || '未知';
        this.modalElement.querySelector('.encoding').textContent = attachment.encoding;

        // 显示加载状态
        this.contentElement.textContent = '加载中...';
        try {
            // 从服务器获取完整内容
            const content = await this.fetchContent(attachment.content_id);
            this.contentElement.textContent = content;
        } catch (error) {
            this.contentElement.textContent = '加载失败：' + error.message;
        }

        // 显示模态框
        const modal = new bootstrap.Modal(this.modalElement);
        modal.show();
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string}
     * @private
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 获取完整文本内容
     * @param {string} contentId - 内容ID
     * @returns {Promise<string>}
     * @private
     */
    async fetchContent(contentId) {
        const response = await fetch(`/api/text/content/${contentId}`);
        if (!response.ok) {
            throw new Error('获取内容失败');
        }
        const data = await response.json();
        return data.content;
    }

    /**
     * 销毁模态框
     */
    dispose() {
        if (this.modalElement) {
            this.modalElement.remove();
            this.modalElement = null;
            this.contentElement = null;
            this.currentAttachment = null;
        }
    }
}
