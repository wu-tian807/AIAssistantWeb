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
                        <div class="text-content-wrapper">
                            <table class="code-table">
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            <button class="modal-mobile-close-btn" data-bs-dismiss="modal" aria-label="关闭">&times;</button>
        `;

        this.contentElement = this.modalElement.querySelector('.code-table tbody');
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
            this.contentElement.innerHTML = '';
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
        
        // 移动端关闭按钮事件
        const mobileCloseBtn = this.modalElement.querySelector('.modal-mobile-close-btn');
        if (mobileCloseBtn) {
            mobileCloseBtn.addEventListener('click', () => {
                if (this.bsModal) {
                    this.bsModal.hide();
                }
            });
        }
        
        // 适配屏幕尺寸变化
        window.addEventListener('resize', () => {
            this.adaptToMobileIfNeeded();
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

            // 清空内容
            if (this.contentElement) {
                this.contentElement.innerHTML = '<tr><td class="line-number">1</td><td class="code-content">加载中...</td></tr>';
            }
            
            // 使用 content_id 获取内容
            const contentId = attachment.content_id;
            console.log('准备获取文本内容，使用content_id:', contentId);
            
            if (contentId) {
                try {
                    let content = '';
                    
                    // 如果附件对象包含完整的文本内容，直接使用不再请求
                    if (attachment.contentBase64) {
                        console.log('发现附件自带文本内容，直接使用而不请求后端');
                        try {
                            content = atob(attachment.contentBase64);
                        } catch (decodeError) {
                            console.error('解码附件中的base64内容失败:', decodeError);
                            // 解码失败时继续尝试从后端获取
                            content = await this.fetchContent(contentId);
                        }
                    } else {
                        // 从后端请求内容
                        console.log('开始从后端请求文本内容...');
                        content = await this.fetchContent(contentId);
                    }
                    
                    console.log('成功获取文本内容，长度:', content.length);
                    
                    // 显示模态框
                    if (this.bsModal) {
                        this.bsModal.show();
                        
                        // 强制重新计算布局
                        this.modalElement.style.display = 'block';
                        this.modalElement.classList.add('show');
                    }
                    
                    // 确保模态框已显示后再渲染内容
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                    // 渲染文本内容到表格中
                    this.renderCodeTable(content);
                    
                    // 如果有代码高亮库，应用它
                    if (window.hljs) {
                        const codeElements = this.modalElement.querySelectorAll('.code-content code');
                        codeElements.forEach(codeElement => {
                            window.hljs.highlightElement(codeElement);
                        });
                    }
                    
                } catch (error) {
                    console.error('获取文本内容失败:', error);
                    if (this.contentElement) {
                        this.contentElement.innerHTML = `<tr><td class="line-number">1</td><td class="code-content">无法加载文本内容: ${error.message}</td></tr>`;
                    }
                }
            } else {
                console.error('无效的文本内容ID:', contentId);
                throw new Error('无效的文本内容ID');
            }

            // 检测是否是移动设备，适配移动端显示
            this.adaptToMobileIfNeeded();
        } catch (error) {
            console.error('显示文本预览失败:', error);
            if (this.contentElement) {
                this.contentElement.innerHTML = `<tr><td class="line-number">1</td><td class="code-content">加载失败：${error.message}</td></tr>`;
            }
        }
    }
    
    /**
     * 根据屏幕大小适配移动端显示
     * @private
     */
    adaptToMobileIfNeeded() {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            // 为移动端添加额外的类
            this.modalElement.classList.add('mobile-view');
            
            // 确保移动端关闭按钮可见
            const mobileCloseBtn = this.modalElement.querySelector('.modal-mobile-close-btn');
            if (mobileCloseBtn) {
                mobileCloseBtn.style.display = 'block';
            }
            
            // 在移动端下，将模态框内容居中显示
            const modalDialog = this.modalElement.querySelector('.modal-dialog');
            if (modalDialog) {
                modalDialog.style.width = '100%';
                modalDialog.style.margin = '0 auto';
            }
            
            // 调整模态框内容的最大高度
            const modalContent = this.modalElement.querySelector('.modal-content');
            if (modalContent) {
                modalContent.style.maxHeight = '100vh';
            }
        } else {
            this.modalElement.classList.remove('mobile-view');
            
            // 恢复桌面端样式
            const modalDialog = this.modalElement.querySelector('.modal-dialog');
            if (modalDialog) {
                modalDialog.style.width = '';
                modalDialog.style.margin = '30px auto';
            }
            
            const modalContent = this.modalElement.querySelector('.modal-content');
            if (modalContent) {
                modalContent.style.maxHeight = '';
            }
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
     * 将文本内容渲染到表格中
     * @param {string} content - 文本内容
     * @private
     */
    renderCodeTable(content) {
        if (!content || !this.contentElement) return;
        
        // 统一换行符，处理Windows格式(\r\n)和旧Mac格式(\r)
        const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // 按行分割内容
        let lines = normalizedContent.split('\n');
        
        // 检测是否是表格样式的文本（隔行数据模式）
        const isAlternatingFormat = this.detectAlternatingFormat(lines);
        
        // 如果检测到是隔行数据格式，过滤掉空白行
        if (isAlternatingFormat) {
            lines = lines.filter((line, index) => {
                // 保留所有非空行和第一行/最后一行的空行
                return line.trim() !== '' || index === 0 || index === lines.length - 1;
            });
        }
        
        // 直接构建HTML字符串，性能更好
        let html = '';
        
        // 为每行创建一个表格行
        lines.forEach((line, index) => {
            const escapedLine = line.replace(/&/g, '&amp;')
                                     .replace(/</g, '&lt;')
                                     .replace(/>/g, '&gt;');
            
            // 空行处理
            const displayLine = escapedLine || '&nbsp;';
            
            // 构建表格行HTML
            html += `<tr>
                <td class="line-number">${index + 1}</td>
                <td class="code-content">${displayLine}</td>
            </tr>`;
        });
        
        // 一次性设置HTML内容
        this.contentElement.innerHTML = html;
    }

    /**
     * 检测文本是否是隔行数据格式（内容行后跟空行的模式）
     * @param {Array<string>} lines - 文本行数组
     * @returns {boolean} - 是否检测到隔行数据格式
     * @private
     */
    detectAlternatingFormat(lines) {
        if (lines.length < 6) return false; // 太短无法可靠检测
        
        // 检查前10行或全部行（取较小值）
        const linesToCheck = Math.min(20, lines.length);
        let emptyLineCount = 0;
        let contentLineCount = 0;
        let alternatingPattern = 0;
        
        for (let i = 0; i < linesToCheck; i++) {
            const isEmpty = lines[i].trim() === '';
            
            if (isEmpty) {
                emptyLineCount++;
                // 检查是否形成模式：非空行后跟空行
                if (i > 0 && lines[i-1].trim() !== '') {
                    alternatingPattern++;
                }
            } else {
                contentLineCount++;
                // 检查是否形成模式：空行后跟非空行
                if (i > 0 && lines[i-1].trim() === '') {
                    alternatingPattern++;
                }
            }
        }
        
        // 计算空行比例和交替模式匹配度
        const emptyLineRatio = emptyLineCount / linesToCheck;
        const alternatingRatio = alternatingPattern / (linesToCheck - 1);
        
        // 如果空行比例在30%-70%之间，且交替模式匹配度高于50%，判定为隔行数据格式
        return (emptyLineRatio >= 0.3 && 
                emptyLineRatio <= 0.7 && 
                alternatingRatio >= 0.4);
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
