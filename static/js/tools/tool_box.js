export class ToolBox {
    constructor(messageContent, md) {
        this.container = document.createElement('div');
        this.container.className = 'tool-box';
        this.container.style.display = 'none';
        this.container.style.order = '0'; // 默认顺序，与普通内容相同
        this.messageContent = messageContent;
        this.md = md;
        this.steps = [];
        this.result = null;
        this.toolName = '';
        this.toolCallId = '';
        this.status = 'running'; // running, success, error
        this.isCollapsed = true; // 默认为收起状态
        this.insertPosition = null; // 用于记录工具框的插入位置
        this.resultShown = false; // 添加结果已显示标记
        
        // 创建头部容器
        this.headerContainer = document.createElement('div');
        this.headerContainer.className = 'tool-box-header';
        // 添加点击事件，点击标题栏展开/收起
        this.headerContainer.onclick = (e) => {
            // 阻止事件冒泡，避免点击展开/收起按钮时触发此事件
            if (e.target !== this.toggleButton) {
                this.toggle();
            }
        };
        
        // 创建标题
        this.titleSpan = document.createElement('span');
        this.titleSpan.className = 'tool-box-title';
        this.titleSpan.textContent = '工具调用';
        
        // 创建工具名称
        this.nameSpan = document.createElement('span');
        this.nameSpan.className = 'tool-box-name';
        
        // 创建状态标签
        this.statusSpan = document.createElement('span');
        this.statusSpan.className = 'tool-box-status running';
        this.statusSpan.textContent = '执行中';
        
        // 创建收起/展开按钮
        this.toggleButton = document.createElement('button');
        this.toggleButton.className = 'tool-box-toggle';
        this.toggleButton.innerHTML = '展开';
        this.toggleButton.onclick = (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            this.toggle();
        };
        
        // 将标题和名称添加到头部容器
        this.headerContainer.appendChild(this.titleSpan);
        this.headerContainer.appendChild(this.nameSpan);
        this.headerContainer.appendChild(this.statusSpan);
        this.headerContainer.appendChild(this.toggleButton);
        
        // 创建可折叠区域包装器
        this.collapsibleContainer = document.createElement('div');
        this.collapsibleContainer.className = 'tool-box-collapsible collapsed'; // 默认为收起状态
        
        // 创建内容容器
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'tool-box-content';
        
        // 创建结果容器
        this.resultContainer = document.createElement('div');
        this.resultContainer.className = 'tool-box-result';
        this.resultContainer.style.display = 'none';
        
        // 将内容和结果容器添加到可折叠区域
        this.collapsibleContainer.appendChild(this.contentContainer);
        this.collapsibleContainer.appendChild(this.resultContainer);
        
        // 创建进度条
        this.progressContainer = document.createElement('div');
        this.progressContainer.className = 'tool-box-progress';
        this.progressBar = document.createElement('div');
        this.progressBar.className = 'tool-box-progress-bar';
        this.progressBar.style.width = '0%';
        this.progressContainer.appendChild(this.progressBar);
        
        // 将头部容器和可折叠区域添加到主容器
        this.container.appendChild(this.headerContainer);
        this.container.appendChild(this.progressContainer);
        this.container.appendChild(this.collapsibleContainer);
        
        // 记录创建时间，用于排序
        this.creationTime = Date.now();
        
        // 将工具框添加到消息内容中的适当位置
        this.placeInMessageContent();
    }
    
    // 在消息内容中放置工具框
    placeInMessageContent() {
        // 查找消息内容中是否已有思考框
        const reasoningBox = this.messageContent.querySelector('.reasoning-box');
        const textContent = this.messageContent.querySelector('.text-content');
        
        // 检查text-content是否已经包含内容
        const hasExistingText = textContent && textContent.textContent.trim().length > 0;
        
        if (reasoningBox && !hasExistingText) {
            // 如果有思考框但没有文本内容，插入在思考框之后
            if (reasoningBox.nextSibling) {
                this.messageContent.insertBefore(this.container, reasoningBox.nextSibling);
            } else {
                this.messageContent.appendChild(this.container);
            }
        } else if (reasoningBox && hasExistingText) {
            // 如果同时存在思考框和文本内容
            // 获取当前文本节点位置，以便后续更新时正确插入
            this.updateToolBoxPosition();
        } else if (hasExistingText) {
            // 如果只有文本内容，根据文本位置决定插入点
            this.updateToolBoxPosition();
        } else {
            // 如果都没有，直接添加到消息内容末尾
            this.messageContent.appendChild(this.container);
        }
    }
    
    // 更新工具框的位置
    updateToolBoxPosition() {
        // 确保工具框是可见的
        this.container.style.display = 'block';
        
        // 检查是否需要重新计算位置
        if (this.container.parentNode) {
            // 如果工具框已经插入到DOM中，则不需要重新计算位置
            return;
        }
        
        // 获取文本内容元素
        const textContent = this.messageContent.querySelector('.text-content');
        
        // 获取所有现有的工具框
        const existingToolBoxes = Array.from(this.messageContent.querySelectorAll('.tool-box'));
        
        // 如果没有现有的工具框且没有文本内容，则直接添加到末尾
        if (existingToolBoxes.length === 0 && (!textContent || textContent.textContent.trim().length === 0)) {
            this.messageContent.appendChild(this.container);
            console.log("工具框添加到消息内容末尾");
            this.container._toolBoxInstance = this;
            return;
        }
        
        // 按插入位置或创建时间对工具框进行排序
        const sortedToolBoxes = existingToolBoxes.sort((a, b) => {
            const posA = a._toolBoxInstance ? a._toolBoxInstance.getInsertPositionMark() : 0;
            const posB = b._toolBoxInstance ? b._toolBoxInstance.getInsertPositionMark() : 0;
            return posA - posB;
        });
        
        // 找到合适的插入位置
        let insertBeforeElement = null;
        
        if (this.insertPosition) {
            // 如果有明确的插入位置，根据插入位置查找合适的工具框
            for (const box of sortedToolBoxes) {
                if (box._toolBoxInstance && box._toolBoxInstance.getInsertPositionMark() > this.insertPosition) {
                    insertBeforeElement = box;
                    break;
                }
            }
            
            // 如果找到了插入位置的工具框，插入到该工具框之前
            if (insertBeforeElement) {
                this.messageContent.insertBefore(this.container, insertBeforeElement);
                console.log(`工具框插入到位置标记 ${this.insertPosition} 处的工具框之前`);
            } 
            // 如果有文本内容，尝试插入到文本内容的适当位置
            else if (textContent) {
                // 按插入位置在文本内容中查找适当的位置
                // 这里可以根据实际需求完善，例如在特定标记处插入
                if (this.insertPosition === 0) {
                    // 插入位置为0，插入到文本内容前面
                    this.messageContent.insertBefore(this.container, textContent);
                    console.log("工具框插入到文本内容前面");
                } else {
                    // 其他插入位置，插入到文本内容后面
                    if (textContent.nextSibling) {
                        this.messageContent.insertBefore(this.container, textContent.nextSibling);
                    } else {
                        this.messageContent.appendChild(this.container);
                    }
                    console.log(`工具框插入到文本内容后面，位置标记：${this.insertPosition}`);
                }
            } else {
                // 没有找到合适的工具框也没有文本内容，添加到末尾
                this.messageContent.appendChild(this.container);
                console.log(`工具框添加到消息内容末尾，位置标记：${this.insertPosition}`);
            }
        } else {
            // 没有明确的插入位置，使用创建时间排序
            for (const box of sortedToolBoxes) {
                if (box._toolBoxInstance && box._toolBoxInstance.getInsertPositionMark() > this.creationTime) {
                    insertBeforeElement = box;
                    break;
                }
            }
            
            // 插入工具框
            if (insertBeforeElement) {
                this.messageContent.insertBefore(this.container, insertBeforeElement);
                console.log("工具框插入到其他工具框之前");
            } else if (textContent) {
                // 如果有文本内容，插入到文本内容后面
                if (textContent.nextSibling) {
                    this.messageContent.insertBefore(this.container, textContent.nextSibling);
                } else {
                    this.messageContent.appendChild(this.container);
                }
                console.log("工具框插入到文本内容的后面");
            } else {
                // 如果不存在文本内容，则直接添加到消息内容末尾
                this.messageContent.appendChild(this.container);
                console.log("工具框添加到消息内容末尾（无文本内容）");
            }
        }
        
        // 保存实例引用到DOM元素，方便后续访问
        this.container._toolBoxInstance = this;
    }
    
    // 设置工具名称
    setToolName(name) {
        this.toolName = name;
        this.nameSpan.textContent = name ? `${name}` : '';
    }
    
    // 设置工具调用ID
    setToolCallId(id) {
        this.toolCallId = id;
    }
    
    // 设置工具序号
    setToolIndex(index) {
        this.toolIndex = index;
        // 更新标题显示
        if (this.toolIndex !== undefined) {
            this.titleSpan.textContent = `工具调用 #${this.toolIndex + 1}`;
        }
    }
    
    // 添加工具执行步骤
    addStep(stepData) {
        // 确保容器可见
        this.container.style.display = 'block';
        
        // 更新工具名称(如果还没设置)
        if (!this.toolName && stepData.tool_name) {
            this.setToolName(stepData.tool_name);
        }
        
        // 更新工具ID(如果还没设置)
        if (!this.toolCallId && stepData.tool_call_id) {
            this.setToolCallId(stepData.tool_call_id);
        }
        
        // 添加步骤数据
        this.steps.push(stepData);
        
        // 检查工具框是否在DOM中，如果不在则重新插入
        if (!this.container.parentNode) {
            console.log("工具框不在DOM中，重新插入");
            this.updateToolBoxPosition();
        }
        
        // 更新进度条
        this.updateProgress();
        
        // 渲染内容
        this.render();
        
        // 确保收起状态
        this.collapse();
        
        // 滚动到可见区域
        this.scrollIntoViewIfNeeded();
    }
    
    // 设置工具执行结果
    setResult(resultData) {
        // 确保容器可见
        this.container.style.display = 'block';
        
        // 更新工具名称(如果还没设置)
        if (!this.toolName && resultData.tool_name) {
            this.setToolName(resultData.tool_name);
        }
        
        // 更新工具ID(如果还没设置)
        if (!this.toolCallId && resultData.tool_call_id) {
            this.setToolCallId(resultData.tool_call_id);
        }
        
        // 设置结果
        this.result = resultData;
        
        // 更新状态
        this.status = resultData.status || 'success';
        this.statusSpan.className = `tool-box-status ${this.status}`;
        this.statusSpan.textContent = this.status === 'success' ? '成功' : 
                                      this.status === 'error' ? '错误' : '完成';
        
        // 完成进度条
        this.progressBar.style.width = '100%';
        
        // 移除进行中的类
        this.container.classList.remove('in-progress');
        
        // 检查工具框是否在DOM中，如果不在则重新插入
        if (!this.container.parentNode) {
            console.log("工具框不在DOM中，重新插入");
            this.updateToolBoxPosition();
        }
        
        // 渲染内容
        this.render();
        
        // 设置为收起状态，但更新结果摘要
        this.resultShown = true; // 标记结果已显示
        this.collapse(); // 确保默认收起状态
        
        // 滚动到可见区域
        this.scrollIntoViewIfNeeded();
    }
    
    // 设置插入位置标记
    setInsertPositionMark(position) {
        this.insertPosition = position;
        // 更新创建时间，可以用来控制顺序
        this.creationTime = position;
        
        // 如果已经在DOM中，需要重新定位
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
            this.updateToolBoxPosition();
        }
    }
    
    // 获取插入位置标记
    getInsertPositionMark() {
        // 如果插入位置未设置，则返回创建时间作为备选
        return this.insertPosition || this.creationTime || Date.now();
    }
    
    // 更新进度条
    updateProgress() {
        // 添加进行中的类
        this.container.classList.add('in-progress');
        // 简单实现：步骤越多，进度条越长
        const progress = Math.min(90, this.steps.length * 15); // 最多到90%，留下最后10%给结果
        this.progressBar.style.width = `${progress}%`;
    }
    
    // 渲染内容
    render() {
        // 确保容器可见
        this.container.style.display = 'block';
        
        // 清空内容容器
        this.contentContainer.innerHTML = '';
        this.resultContainer.style.display = 'none'; // 默认隐藏结果容器
        
        // 渲染步骤
        if (this.steps.length > 0) {
            this.steps.forEach((step, index) => {
                const stepDiv = document.createElement('div');
                stepDiv.className = 'tool-box-step';
                
                // 提取步骤内容
                let stepContent = '';
                if (step.display_text) {
                    stepContent = step.display_text;
                } else if (step.content) {
                    stepContent = step.content;
                } else if (typeof step === 'string') {
                    stepContent = step;
                } else {
                    // 如果没有明确的内容，尝试格式化整个对象
                    stepContent = `步骤 ${index + 1}: ${JSON.stringify(step, null, 2)}`;
                }
                
                // 渲染内容
                stepDiv.innerHTML = this.md.render(stepContent);
                
                // 添加到容器
                this.contentContainer.appendChild(stepDiv);
            });
            
            // 应用代码高亮
            this.applyCodeHighlight(this.contentContainer);
        }
        
        // 渲染结果
        if (this.result) {
            this.resultContainer.style.display = 'block';
            
            let resultContent = '';
            if (this.result.display_text) {
                resultContent = this.result.display_text;
            } else if (this.result.result) {
                if (typeof this.result.result === 'string') {
                    resultContent = this.result.result;
                } else {
                    try {
                        resultContent = `\`\`\`json\n${JSON.stringify(this.result.result, null, 2)}\n\`\`\``;
                    } catch (e) {
                        resultContent = String(this.result.result);
                    }
                }
            } else if (this.result.error) {
                resultContent = `错误: ${this.result.error}`;
            } else {
                resultContent = `结果: ${JSON.stringify(this.result, null, 2)}`;
            }
            
            // 如果没有步骤但有结果，添加一个结果概要到工具名称后面
            if (this.steps.length === 0) {
                let summaryText = '';
                if (this.result.display_text) {
                    // 从显示文本中提取简短摘要
                    summaryText = this.result.display_text.substring(0, 20);
                    if (this.result.display_text.length > 20) {
                        summaryText += '...';
                    }
                } else if (typeof this.result.result === 'string') {
                    summaryText = this.result.result.substring(0, 20);
                    if (this.result.result.length > 20) {
                        summaryText += '...';
                    }
                } else if (this.result.result) {
                    // 如果结果是对象，尝试获取有意义的属性
                    try {
                        const resultObj = typeof this.result.result === 'object' ? 
                            this.result.result : JSON.parse(this.result.result);
                        // 尝试从常见属性中获取摘要
                        if (resultObj.content) {
                            summaryText = String(resultObj.content).substring(0, 20);
                        } else if (resultObj.message) {
                            summaryText = String(resultObj.message).substring(0, 20);
                        } else if (resultObj.data) {
                            summaryText = typeof resultObj.data === 'object' ? 
                                JSON.stringify(resultObj.data).substring(0, 20) : 
                                String(resultObj.data).substring(0, 20);
                        } else {
                            // 转换为字符串并截取
                            summaryText = JSON.stringify(resultObj).substring(0, 20);
                        }
                        
                        if (summaryText.length > 20) {
                            summaryText += '...';
                        }
                    } catch (e) {
                        // 如果解析失败，使用简单字符串
                        summaryText = "查看结果";
                    }
                }
                
                if (summaryText) {
                    // 检测是否为移动设备
                    const isMobile = window.innerWidth <= 768;
                    const truncateLength = isMobile ? 15 : 20;
                    
                    // 移动设备上使用更短的摘要
                    if (isMobile && summaryText.length > truncateLength) {
                        summaryText = summaryText.substring(0, truncateLength) + '...';
                    }
                    
                    // 更新工具名称，添加结果摘要
                    const originalName = this.nameSpan.textContent;
                    this.nameSpan.innerHTML = `${originalName} <span style="opacity: 0.8; font-size: 0.9em;">(${summaryText})</span>`;
                }
            }
            
            this.resultContainer.innerHTML = this.md.render(resultContent);
            this.applyCodeHighlight(this.resultContainer);
        }
        
        // 如果没有步骤且结果已经设置，确保展开按钮可见
        if (this.steps.length === 0 && this.result) {
            // 结果已经完成，确保按钮可见
            this.toggleButton.style.display = 'inline-block';
        }
        
        // 确保始终为收起状态
        this.collapse();
    }
    
    // 应用代码高亮
    applyCodeHighlight(container) {
        // 获取所有代码块
        const codeBlocks = container.querySelectorAll('pre code');
        codeBlocks.forEach(block => {
            // 获取语言类名
            const langClass = Array.from(block.classList)
                .find(className => className.startsWith('language-'));
            const lang = langClass ? langClass.replace('language-', '') : '';
            
            // 保持原有的语言类名
            if (lang && lang !== 'plaintext') {
                block.className = `hljs language-${lang}`;
            } else {
                block.className = 'hljs';
            }
            
            // 应用高亮
            try {
                hljs.highlightElement(block);
            } catch (e) {
                console.warn('Code highlighting failed:', e);
                // 如果高亮失败，至少确保基本样式
                block.className = 'hljs';
            }
        });
        
        // 为代码块中的复制按钮添加事件监听
        container.querySelectorAll('.code-block-header .copy-button[data-action="copy"]').forEach(button => {
            // 移除可能的旧事件监听器
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            // 添加新的事件监听
            newButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const wrapper = this.closest('.code-block-wrapper');
                if (!wrapper) return;
                
                const pre = wrapper.querySelector('pre');
                if (!pre) return;
                
                const code = pre.querySelector('code');
                if (!code) return;
                
                const text = code.innerText || code.textContent;
                
                try {
                    // 使用传统剪贴板API作为备选方案
                    if (!navigator.clipboard) {
                        ToolBox.fallbackCopyTextToClipboard(text, this);
                        return;
                    }
                    
                    navigator.clipboard.writeText(text)
                        .then(() => {
                            this.textContent = '已复制！';
                            this.classList.add('copied');
                            
                            setTimeout(() => {
                                this.textContent = '复制代码';
                                this.classList.remove('copied');
                            }, 2000);
                        })
                        .catch(err => {
                            console.error('复制失败:', err);
                            ToolBox.fallbackCopyTextToClipboard(text, this);
                        });
                } catch (err) {
                    console.error('复制出错:', err);
                    ToolBox.fallbackCopyTextToClipboard(text, this);
                }
            });
        });
    }
    
    // 传统复制方法
    static fallbackCopyTextToClipboard(text, button) {
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            
            // 避免滚动到底部
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                button.textContent = '已复制！';
                button.classList.add('copied');
            } else {
                button.textContent = '复制失败';
            }
            
            setTimeout(() => {
                button.textContent = '复制代码';
                button.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('备选复制方法失败:', err);
            button.textContent = '复制失败';
            setTimeout(() => {
                button.textContent = '复制代码';
            }, 2000);
        }
    }
    
    // 切换收起/展开状态
    toggle() {
        if (this.isCollapsed) {
            this.expand();
        } else {
            this.collapse();
        }
    }
    
    // 收起内容
    collapse() {
        this.isCollapsed = true;
        this.toggleButton.innerHTML = '展开';
        this.collapsibleContainer.classList.add('collapsed');
    }
    
    // 展开内容
    expand() {
        this.isCollapsed = false;
        this.toggleButton.innerHTML = '收起';
        this.collapsibleContainer.classList.remove('collapsed');
    }
    
    // 判断是否应该自动滚动
    shouldAutoScroll(container) {
        // 使用全局函数检查是否应该滚动
        if (typeof window.shouldAutoScroll === 'function') {
            return window.shouldAutoScroll(container);
        }
        // 如果全局函数不可用，使用保守的滚动策略
        const threshold = 50;
        return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    }
    
    // 如果需要，滚动到可见区域
    scrollIntoViewIfNeeded() {
        const chatMessages = document.getElementById('chat-messages');
        if (this.shouldAutoScroll(chatMessages)) {
            // 使用全局滚动函数
            if (window.ensureScrollToBottom) {
                setTimeout(() => {
                    window.ensureScrollToBottom(chatMessages);
                }, 10);
            } else if (window.scrollToBottom) {
                setTimeout(() => {
                    window.scrollToBottom(false);
                }, 10);
            }
        }
    }
    
    // 清空内容
    clear() {
        this.steps = [];
        this.result = null;
        this.contentContainer.innerHTML = '';
        this.resultContainer.innerHTML = '';
        this.resultContainer.style.display = 'none';
        this.hide();
    }
    
    // 显示工具框
    show() {
        this.container.style.display = 'block';
    }
    
    // 隐藏工具框
    hide() {
        this.container.style.display = 'none';
    }
    
    // 获取DOM元素
    getElement() {
        return this.container;
    }
    
    // 获取工具名称
    getToolName() {
        return this.toolName;
    }
    
    // 获取工具调用ID
    getToolCallId() {
        return this.toolCallId;
    }
    
    // 获取工具索引
    getToolIndex() {
        return this.toolIndex || 0;
    }
    
    // 获取状态
    getStatus() {
        return this.status;
    }
    
    // 获取结果
    getResult() {
        return this.result;
    }
    
    // 获取步骤
    getSteps() {
        return this.steps;
    }
    
    // 序列化工具框，用于保存到数据库
    serializeForStorage() {
        return {
            tool_name: this.toolName,
            tool_call_id: this.toolCallId,
            tool_index: this.toolIndex,
            status: this.status,
            steps: this.steps,
            result: this.result,
            insert_position: this.insertPosition || this.creationTime,
            is_collapsed: this.isCollapsed
        };
    }
    
    // 从存储的数据中加载工具框
    loadFromSerializedData(data) {
        if (!data) return;
        
        // 设置基本属性
        if (data.tool_name) {
            this.setToolName(data.tool_name);
        }
        
        if (data.tool_call_id) {
            this.setToolCallId(data.tool_call_id);
        }
        
        // 设置工具序号
        if (data.tool_index !== undefined) {
            this.setToolIndex(data.tool_index);
        }
        
        // 设置状态
        this.status = data.status || 'success';
        this.statusSpan.className = `tool-box-status ${this.status}`;
        this.statusSpan.textContent = this.status === 'success' ? '成功' : 
                                     this.status === 'error' ? '错误' : '完成';
        
        // 加载步骤
        if (data.steps && Array.isArray(data.steps)) {
            this.steps = data.steps;
        }
        
        // 加载结果
        if (data.result) {
            this.result = data.result;
            this.resultContainer.style.display = 'block';
            this.resultShown = true;
        }
        
        // 设置插入位置
        if (data.insert_position) {
            this.setInsertPositionMark(data.insert_position);
        }
        
        // 始终设置为收起状态，忽略存储的状态
        this.collapse();
        
        // 设置进度条为完成状态
        this.progressBar.style.width = '100%';
        
        // 渲染内容
        this.render();
        
        // 确保可见
        this.container.style.display = 'block';
    }
    
    // 创建工具框实例并从序列化数据中加载
    static createFromSerializedData(messageContent, md, data) {
        const toolBox = new ToolBox(messageContent, md);
        toolBox.loadFromSerializedData(data);
        
        // 确保DOM元素上设置了_toolBoxInstance引用
        if (toolBox.container) {
            toolBox.container._toolBoxInstance = toolBox;
        }
        
        return toolBox;
    }
}