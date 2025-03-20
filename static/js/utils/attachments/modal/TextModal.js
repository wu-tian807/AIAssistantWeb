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

            // 确保size是数字类型 - 尝试多种方式确保获取到有效的数字
            let fileSize = 0;
            if (attachment.size !== undefined && attachment.size !== null) {
                if (typeof attachment.size === 'number') {
                    fileSize = attachment.size;
                } else if (typeof attachment.size === 'string') {
                    fileSize = Number(attachment.size);
                    if (isNaN(fileSize)) {
                        fileSize = parseInt(attachment.size, 10) || 0;
                    }
                }
            }
            
            console.log('处理后的文件大小:', fileSize, '字节', '原始大小:', attachment.size, '类型:', typeof attachment.size);

            // 更新文件信息
            this.modalElement.querySelector('.file-name').textContent = attachment.fileName || '未命名文本';
            this.modalElement.querySelector('.file-size').textContent = this.formatFileSize(fileSize);
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
     * 从服务器获取文本内容
     * @param {string} contentId - 内容唯一ID
     * @returns {Promise<string>} - 文本内容
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
            
            // 更新附件属性
            if (this.currentAttachment) {
                // 更新文件大小
                if (data.size !== undefined) {
                    this.currentAttachment.size = Number(data.size);
                    console.log('从响应更新文件大小:', this.currentAttachment.size);
                    // 立即更新UI上的文件大小显示
                    this.modalElement.querySelector('.file-size').textContent = this.formatFileSize(this.currentAttachment.size);
                }
                
                // 更新文件扩展名
                if (data.extension) {
                    this.currentAttachment.extension = data.extension;
                    console.log('从响应更新文件扩展名:', this.currentAttachment.extension);
                }
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
        
        console.log('原始内容长度:', content.length);
        
        // 统一换行符处理，避免\r\n和\r的问题
        // 使用特殊标记避免重复替换
        let normalizedContent = content.replace(/\r\n/g, '\uE000')  // 先将\r\n替换为特殊字符
                                      .replace(/\r/g, '\n')       // 将单独的\r替换为\n
                                      .replace(/\uE000/g, '\n');  // 将特殊字符恢复为\n
        
        // 按行分割内容
        let lines = normalizedContent.split('\n');
        
        console.log('分割后总行数:', lines.length);
        
        // 检查并打印前几行的内容，帮助调试
        console.log('前10行内容预览:');
        for (let i = 0; i < Math.min(10, lines.length); i++) {
            console.log(`第${i+1}行 [${lines[i].length}]: "${lines[i]}"`);
        }
        
        // 检查文本模式（是否为表格式数据）
        let isTableFormat = false;
        
        // 计算非空行和空行的数量和比例
        let emptyLines = 0;
        let nonEmptyLines = 0;
        let alternatingPattern = 0;
        
        // 只检查前20行或全部行（取较少值）
        const linesToCheck = Math.min(20, lines.length);
        for (let i = 0; i < linesToCheck; i++) {
            if (lines[i].trim() === '') {
                emptyLines++;
                // 检查是否形成交替模式：内容行后空行
                if (i > 0 && lines[i-1].trim() !== '') {
                    alternatingPattern++;
                }
            } else {
                nonEmptyLines++;
            }
        }
        
        // 计算空行比例和交替模式比例
        const emptyLineRatio = emptyLines / linesToCheck;
        const alternatingRatio = (alternatingPattern * 2) / linesToCheck;
        
        console.log(`空行比例: ${emptyLineRatio.toFixed(2)}, 交替模式比例: ${alternatingRatio.toFixed(2)}`);
        
        // 如果空行比例在30%-70%之间，且交替比例较高，认为是表格式数据
        if (emptyLineRatio >= 0.3 && emptyLineRatio <= 0.7 && alternatingRatio >= 0.5) {
            isTableFormat = true;
            console.log('检测到表格式数据，将移除所有空行');
            lines = lines.filter(line => line.trim() !== '');
        } else {
            // 标准文本格式，只处理连续空行问题
            // 一个重要的发现：HTML渲染会让每个空行本身变成一个空行，我们不需要保留原始空行
            
            // 我们使用一个新的数组来收集处理后的行
            let processedLines = [];
            let consecutiveEmptyLines = 0;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const isEmptyLine = line.trim() === '';
                
                if (isEmptyLine) {
                    consecutiveEmptyLines++;
                    
                    // 对于连续空行，只保留第一个
                    if (consecutiveEmptyLines === 1) {
                        // 使用一个空格替代完全空白行，避免HTML渲染问题
                        processedLines.push(' ');
                    }
                } else {
                    // 遇到非空行，重置计数器并添加该行
                    consecutiveEmptyLines = 0;
                    processedLines.push(line);
                }
            }
            
            console.log(`处理前行数: ${lines.length}, 处理后行数: ${processedLines.length}`);
            lines = processedLines;
        }
        
        // 生成HTML内容
        let html = '';
        
        lines.forEach((line, index) => {
            // 转义HTML特殊字符
            const escapedLine = line.replace(/&/g, '&amp;')
                                    .replace(/</g, '&lt;')
                                    .replace(/>/g, '&gt;');
            
            // 对于完全空白行需要特殊处理，确保在表格中显示一个空行
            const displayLine = escapedLine || '&nbsp;';
            
            html += `<tr>
                <td class="line-number">${index + 1}</td>
                <td class="code-content">${displayLine}</td>
            </tr>`;
        });
        
        // 设置内容
        this.contentElement.innerHTML = html;
        
        console.log('渲染完成，最终行数:', lines.length);
    }

    /**
     * 检测文本是否是隔行数据格式（内容行后跟空行的模式）
     * @param {Array<string>} lines - 文本行数组
     * @returns {boolean} - 是否检测到隔行数据格式
     * @private
     */
    detectAlternatingFormat(lines) {
        // 由于我们有了更精确的detectEmptyLinePattern方法，可以直接使用其判断
        return this.detectEmptyLinePattern(lines) === 'alternating';
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
