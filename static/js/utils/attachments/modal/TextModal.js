/**
 * 文本预览模态框
 */
export class TextModal {
    static instance = null;

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
     * @type {bootstrap.Modal}
     * @private
     */
    bsModal;

    /**
     * 创建文本预览模态框
     */
    constructor() {
        if (TextModal.instance) {
            return TextModal.instance;
        }
        this.createModal();
        this.initModal();
        this.bindEvents();
        TextModal.instance = this;
    }

    /**
     * 创建模态框DOM结构
     * @private
     */
    createModal() {
        // 检查是否已存在模态框
        const existingModal = document.querySelector('.text-preview-modal');
        if (existingModal) {
            existingModal.remove();
        }

        this.modalElement = document.createElement('div');
        this.modalElement.className = 'text-preview-modal modal';
        this.modalElement.setAttribute('tabindex', '-1');
        this.modalElement.setAttribute('role', 'dialog');
        this.modalElement.setAttribute('inert', 'true');
        this.modalElement.innerHTML = `
            <div class="modal-dialog modal-lg" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">文本预览</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="text-info mb-3">
                            <div class="row">
                                <div class="col-md-6">
                                    <p><strong>文件名：</strong><span class="file-name"></span></p>
                                    <p><strong>编码：</strong><span class="encoding"></span></p>
                                </div>
                                <div class="col-md-6">
                                    <p><strong>行数：</strong><span class="line-count"></span></p>
                                    <p><strong>大小：</strong><span class="file-size"></span></p>
                                </div>
                            </div>
                        </div>
                        <div class="text-content">
                            <pre><code></code></pre>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.contentElement = this.modalElement.querySelector('.text-content code');
        document.body.appendChild(this.modalElement);

        // 立即初始化 Bootstrap 模态框
        if (window.bootstrap) {
            this.bsModal = new window.bootstrap.Modal(this.modalElement);
        }
    }

    /**
     * 初始化 Bootstrap 模态框
     * @private
     */
    async initModal() {
        try {
            // 等待 Bootstrap 加载完成
            if (typeof window.bootstrap === 'undefined') {
                console.warn('Bootstrap 未加载，等待加载...');
                for (let i = 0; i < 10; i++) { // 最多等待1秒
                    await new Promise(resolve => setTimeout(resolve, 100));
                    if (typeof window.bootstrap !== 'undefined') break;
                }
            }
            
            if (typeof window.bootstrap === 'undefined') {
                throw new Error('Bootstrap 未能正确加载');
            }

            if (!this.bsModal && this.modalElement) {
                this.bsModal = new window.bootstrap.Modal(this.modalElement, {
                    backdrop: true,
                    keyboard: true,
                    focus: true
                });
            }
        } catch (error) {
            console.error('初始化模态框失败:', error);
            throw error;
        }
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

        // 处理ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.bsModal) {
                this.bsModal.hide();
            }
        });
        
        // 模态框打开后设置焦点和移除inert属性
        this.modalElement.addEventListener('shown.bs.modal', () => {
            // 移除inert属性，允许屏幕阅读器访问内容
            this.modalElement.removeAttribute('inert');
            
            // 设置初始焦点到关闭按钮
            const closeButton = this.modalElement.querySelector('.btn-close');
            if (closeButton) {
                closeButton.focus();
            }
        });
        
        // 模态框隐藏时重新添加inert属性
        this.modalElement.addEventListener('hide.bs.modal', () => {
            this.modalElement.setAttribute('inert', 'true');
        });
    }

    /**
     * 显示文本预览
     * @param {TextAttachment} attachment - 文本附件对象
     * @returns {Promise<void>}
     */
    async show(attachment) {
        try {
            console.log('TextModal.show开始，附件信息:', JSON.stringify(attachment, null, 2));
            
            // 确保模态框已初始化
            await this.initModal();
            
            this.currentAttachment = attachment;

            // 更新文件信息
            this.modalElement.querySelector('.file-name').textContent = attachment.fileName || '未命名文本';
            this.modalElement.querySelector('.file-size').textContent = this.formatFileSize(attachment.size || 0);
            this.modalElement.querySelector('.line-count').textContent = attachment.lineCount || '0';
            this.modalElement.querySelector('.encoding').textContent = attachment.encoding || 'UTF-8';

            // 显示加载状态
            this.contentElement.textContent = '加载中...';
            
            // 使用 content_id 获取内容
            const contentId = attachment.content_id;
            console.log('准备获取文本内容，使用content_id:', contentId);
            
            if (contentId) {
                try {
                    // 如果附件对象包含完整的文本内容，直接使用不再请求
                    if (attachment.contentBase64) {
                        console.log('发现附件自带文本内容，直接使用而不请求后端');
                        try {
                            const decodedContent = atob(attachment.contentBase64);
                            this.contentElement.textContent = decodedContent;
                            
                            // 如果有代码高亮库，应用它
                            if (window.hljs) {
                                window.hljs.highlightElement(this.contentElement);
                            }
                            return;
                        } catch (decodeError) {
                            console.error('解码附件中的base64内容失败:', decodeError);
                            // 解码失败时继续尝试从后端获取
                        }
                    }
                    
                    // 从后端请求内容
                    console.log('开始从后端请求文本内容...');
                    const content = await this.fetchContent(contentId);
                    console.log('成功获取文本内容，长度:', content.length);
                    this.contentElement.textContent = content;

                    // 如果有代码高亮库，应用它
                    if (window.hljs) {
                        window.hljs.highlightElement(this.contentElement);
                    }
                } catch (error) {
                    console.error('获取文本内容失败:', error);
                    this.contentElement.textContent = '无法加载文本内容: ' + error.message;
                }
            } else {
                console.error('无效的文本内容ID:', contentId);
                throw new Error('无效的文本内容ID');
            }

            // 显示模态框
            if (this.bsModal) {
                this.bsModal.show();
                // 强制重新计算布局
                this.modalElement.style.display = 'block';
                this.modalElement.classList.add('show');
            } else {
                throw new Error('模态框未正确初始化');
            }
        } catch (error) {
            console.error('显示文本预览失败:', error);
            this.contentElement.textContent = '加载失败：' + error.message;
        }
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
        try {
            console.log(`请求文本内容: /api/text/content/${contentId}`);
            const response = await fetch(`/api/text/content/${contentId}`, {
                headers: {
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: '未知错误' }));
                console.error('获取文本内容响应错误:', response.status, errorData);
                throw new Error(errorData.error || `获取内容失败 (${response.status})`);
            }
            
            const data = await response.json();
            if (!data.content) {
                console.error('响应中没有文本内容:', data);
                throw new Error('响应数据格式错误，找不到文本内容');
            }
            
            return data.content;
        } catch (error) {
            console.error('获取文本内容失败:', error);
            throw error;
        }
    }

    /**
     * 销毁模态框
     */
    dispose() {
        if (this.bsModal) {
            this.bsModal.dispose();
        }
        if (this.modalElement) {
            this.modalElement.remove();
        }
        this.modalElement = null;
        this.contentElement = null;
        this.currentAttachment = null;
        this.bsModal = null;
        TextModal.instance = null;
    }
}
