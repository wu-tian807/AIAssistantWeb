class ReasoningBox {
    constructor(messageContent, md) {
        this.container = document.createElement('div');
        this.container.className = 'reasoning-box';
        this.container.style.display = 'none';
        this.container.style.order = '-1'; // 确保思考框始终在最前
        this.messageContent = messageContent;
        this.md = md;
        this.content = '';
        this.summary = ''; // 新增摘要内容
        this.isCollapsed = false;
        this.hasSummary = false; // 是否已有摘要
        this.summaryGenerating = false; // 是否正在生成摘要
        
        // 计时器相关属性
        this.startTime = null;
        this.endTime = null;
        this.updateTimer = null;
        this.lastContentUpdate = null;
        this.thinkingTime = 0;
        this.isGenerating = false; // 添加标记表示是否正在生成内容
        
        // 创建头部容器
        this.headerContainer = document.createElement('div');
        this.headerContainer.className = 'reasoning-box-header';
        
        // 创建标题
        this.titleSpan = document.createElement('span');
        this.titleSpan.className = 'reasoning-box-title';
        this.titleSpan.textContent = '思考中';  // 初始显示"思考中"
        
        // 创建时间显示
        this.timeSpan = document.createElement('span');
        this.timeSpan.className = 'reasoning-box-time';
        
        // 创建收起/展开按钮
        this.toggleButton = document.createElement('button');
        this.toggleButton.className = 'reasoning-box-toggle';
        this.toggleButton.innerHTML = '收起';
        this.toggleButton.style.display = 'none'; // 初始隐藏按钮
        this.toggleButton.onclick = () => this.toggle();
        
        // 将标题和时间添加到头部容器
        this.headerContainer.appendChild(this.titleSpan);
        this.headerContainer.appendChild(this.timeSpan);
        this.headerContainer.appendChild(this.toggleButton);
        
        // 创建内容容器
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'reasoning-box-content';
        
        // 创建摘要容器
        this.summaryContainer = document.createElement('div');
        this.summaryContainer.className = 'reasoning-box-summary';
        
        // 将头部和内容容器添加到主容器
        this.container.appendChild(this.headerContainer);
        this.container.appendChild(this.summaryContainer);
        this.container.appendChild(this.contentContainer);
        
        // 将思考框添加到消息内容中的最前面
        if (this.messageContent.firstChild) {
            this.messageContent.insertBefore(this.container, this.messageContent.firstChild);
        } else {
            this.messageContent.appendChild(this.container);
        }
    }

    // 开始计时
    startTimer() {
        if (!this.startTime) {
            this.startTime = Date.now();
            this.lastContentUpdate = this.startTime;
            this.isGenerating = true;
            this.updateTimerDisplay();
            
            this.updateTimer = setInterval(() => {
                this.updateTimerDisplay();
            }, 1000);
        }
    }

    // 更新计时器显示
    updateTimerDisplay() {
        if (!this.endTime) {
            const currentTime = Date.now();
            const elapsedTime = currentTime - this.startTime;
            this.timeSpan.textContent = this.formatTime(elapsedTime);
        }
    }

    // 检查是否应该停止计时
    checkStopTimer() {
        if (!this.endTime && !this.isGenerating) {
            setTimeout(() => this.stopTimer(), 100); // 100ms后停止
        }
    }

    // 停止计时
    stopTimer() {
        if (this.updateTimer && !this.endTime) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
            this.endTime = Date.now();
            this.thinkingTime = this.endTime - this.startTime;
            this.isGenerating = false;
            this.titleSpan.textContent = '思考完成';  // 更新标题为"思考完成"
            this.toggleButton.style.display = 'inline-block'; // 显示展开/收起按钮
            this.updateTimerDisplay();
            
            // 在思考结束后生成摘要
            if (this.content && !this.summaryGenerating && !this.hasSummary) {
                this.generateSummary();
            }
        }
    }

    // 格式化时间显示
    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `思考用时：${minutes}分${remainingSeconds}秒`;
    }

    // 获取思考时间（毫秒）
    getThinkingTime() {
        if (this.endTime) {
            return this.thinkingTime;
        } else if (this.startTime) {
            return Date.now() - this.startTime;
        }
        return 0;
    }

    // 设置已记录的思考时间
    setThinkingTime(ms) {
        if (ms && ms > 0) {  // 确保 ms 存在且大于 0
            this.thinkingTime = ms;
            this.startTime = Date.now() - ms; // 设置一个虚拟的开始时间
            this.endTime = Date.now(); // 标记为已结束
            this.timeSpan.textContent = this.formatTime(ms);
            this.titleSpan.textContent = '思考完成';  // 更新标题为"思考完成"
            this.toggleButton.style.display = 'inline-block'; // 显示展开/收起按钮
            this.isGenerating = false; // 标记为未在生成状态
            
            // 如果有内容但没有摘要，则生成摘要
            if (this.content && !this.summaryGenerating && !this.hasSummary) {
                this.generateSummary();
            }
        }
    }

    // 添加思考内容
    appendContent(content) {
        console.log("ReasoningBox.appendContent 被调用，内容:", content);
        this.content += content;
        this.lastContentUpdate = Date.now();
        this.isGenerating = true;
        if (!this.startTime) {
            this.startTimer();
            this.titleSpan.textContent = '思考中';  // 确保显示"思考中"
        }
        // 确保容器可见
        this.container.style.display = 'block';
        this.render();
    }

    // 设置思考内容
    setContent(content) {
        if (content) {
            this.content = content;
            this.lastContentUpdate = Date.now();
            this.isGenerating = false; // 如果是设置已有内容，应该标记为未在生成状态
            if (!this.startTime) {
                this.startTimer();
            }
            // 如果是加载已有内容，应该显示为完成状态
            this.titleSpan.textContent = '思考完成';
            this.toggleButton.style.display = 'inline-block';
            this.render();
            
            // 如果没有摘要，则生成摘要
            if (!this.summaryGenerating && !this.hasSummary) {
                this.generateSummary();
            }
        }
    }
    
    // 设置摘要内容
    setSummary(summary) {
        if (summary) {
            this.summary = summary;
            this.hasSummary = true;
            this.summaryGenerating = false;
            this.summaryContainer.innerHTML = this.md.render(this.summary);
            
            // 显示摘要并自动收起详细内容
            this.summaryContainer.classList.add('visible');
            this.collapseWithAnimation();
        }
    }
    
    // 使用动画收起详细内容
    collapseWithAnimation() {
        // 获取滚动容器和当前滚动状态
        const chatMessages = document.getElementById('chat-messages');
        const wasAtBottom = this.shouldAutoScroll(chatMessages);
        const scrollPosition = chatMessages.scrollTop;
        const oldContentHeight = this.contentContainer.scrollHeight;
    
        // 设置状态
        this.isCollapsed = true;
        this.toggleButton.innerHTML = '展开';
        
        // 添加动画类
        this.contentContainer.classList.add('collapsed');
        
        // 显示摘要
        this.summaryContainer.style.display = 'block';
        
        // 使用setTimeout确保DOM更新后再调整滚动位置
        setTimeout(() => {
            if (wasAtBottom) {
                // 如果之前在底部，则滚动到新的底部
                if (window.scrollToBottom) {
                    window.scrollToBottom(false);
                } else {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            } else {
                // 计算内容高度变化
                const newContentHeight = this.contentContainer.scrollHeight;
                const heightDiff = oldContentHeight - newContentHeight;
                
                // 调整滚动位置，保持相对位置不变
                chatMessages.scrollTop = Math.max(0, scrollPosition - heightDiff);
            }
        }, 50);
    }
    
    // 使用动画展开详细内容
    expandWithAnimation() {
        // 获取滚动容器和当前滚动状态
        const chatMessages = document.getElementById('chat-messages');
        const wasAtBottom = this.shouldAutoScroll(chatMessages);
        const scrollPosition = chatMessages.scrollTop;
    
        // 设置状态
        this.isCollapsed = false;
        this.toggleButton.innerHTML = '收起';
        
        // 移除动画类
        this.contentContainer.classList.remove('collapsed');
        
        // 当展开详细内容时隐藏摘要
        this.summaryContainer.style.display = 'none';
        
        // 使用setTimeout确保DOM更新后再调整滚动位置
        setTimeout(() => {
            if (wasAtBottom) {
                // 如果之前在底部，则滚动到新的底部
                if (window.scrollToBottom) {
                    window.scrollToBottom(false);
                } else {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }
        }, 50);
    }

    // 获取思考内容
    getContent() {
        return this.content;
    }
    
    // 获取摘要内容
    getSummary() {
        return this.summary;
    }

    // 获取可序列化的数据
    getSerializableData() {
        return {
            reasoning_content: this.content,
            reasoning_summary: this.summary,
            reasoning_time: this.getThinkingTime()
        };
    }
    
    // 从序列化数据恢复
    loadFromSerializedData(data) {
        if (!data) return;
        
        // 获取聊天消息容器和滚动状态
        const chatMessages = document.getElementById('chat-messages');
        const wasAtBottom = this.shouldAutoScroll(chatMessages);
        
        // 先显示容器，确保内容可见
        this.container.style.display = 'block';
        
        if (data.reasoning_content) {
            this.setContent(data.reasoning_content);
            // 强制渲染内容
            this.render();
        }
        
        if (data.reasoning_summary) {
            this.summary = data.reasoning_summary;
            this.hasSummary = true;
            this.summaryContainer.innerHTML = this.md.render(this.summary);
            this.summaryContainer.classList.add('visible');
        }
        
        if (data.reasoning_time && data.reasoning_time > 0) {
            this.setThinkingTime(data.reasoning_time);
        }
        
        // 如果有摘要但没有手动折叠，则自动折叠
        if (this.hasSummary && !this.isCollapsed) {
            // 直接调用collapseWithAnimation可能会导致滚动问题
            // 改用直接设置状态
            this.isCollapsed = true;
            this.toggleButton.innerHTML = '展开';
            this.contentContainer.classList.add('collapsed');
            this.summaryContainer.style.display = 'block';
        }
        
        // 确保思考框完全初始化
        this.titleSpan.textContent = '思考完成';
        this.toggleButton.style.display = 'inline-block';
        
        // 如果之前在底部，恢复滚动位置
        if (wasAtBottom) {
            setTimeout(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 50);
        }
    }

    // 切换收起/展开状态
    toggle() {
        if (this.isCollapsed) {
            this.expandWithAnimation();
        } else {
            this.collapseWithAnimation();
        }
    }

    // 渲染内容
    render() {
        this.container.style.display = 'block';
        this.contentContainer.innerHTML = this.md.render(this.content);
        this.applyCodeHighlight();
        this.scrollIntoViewIfNeeded();
    }

    // 应用代码高亮
    applyCodeHighlight() {
        // 导入的initializeCodeBlocks函数可能不直接可用，这里使用与markdownit.js相同的实现
        const codeBlocks = this.contentContainer.querySelectorAll('.code-block-wrapper pre code');
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
        this.contentContainer.querySelectorAll('.code-block-header .copy-button[data-action="copy"]').forEach(button => {
            // 移除可能的旧事件监听器
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            // 添加新的事件监听
            newButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const wrapper = this.closest('.code-block-wrapper');
                if (!wrapper) {
                    console.error('找不到代码块容器');
                    return;
                }
                
                const pre = wrapper.querySelector('pre');
                if (!pre) {
                    console.error('找不到pre元素');
                    return;
                }
                
                const code = pre.querySelector('code');
                if (!code) {
                    console.error('找不到code元素');
                    return;
                }
                
                const text = code.innerText || code.textContent;
                
                try {
                    // 使用传统剪贴板API作为备选方案
                    if (!navigator.clipboard) {
                        ReasoningBox.fallbackCopyTextToClipboard(text, this);
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
                            ReasoningBox.fallbackCopyTextToClipboard(text, this);
                        });
                } catch (err) {
                    console.error('复制出错:', err);
                    ReasoningBox.fallbackCopyTextToClipboard(text, this);
                }
            });
        });
    }
    
    // 添加传统复制方法作为备选
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

    // 判断是否应该自动滚动
    shouldAutoScroll(container) {
        // 仅使用全局函数检查是否应该滚动
        if (typeof window.shouldAutoScroll === 'function') {
            return window.shouldAutoScroll(container);
        }
        // 如果全局函数不可用，使用更保守的滚动策略
        const threshold = 50; // 增加阈值，让自动滚动更容易触发
        return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    }

    // 如果需要，滚动到可见区域
    scrollIntoViewIfNeeded() {
        const chatMessages = document.getElementById('chat-messages');
        if (this.shouldAutoScroll(chatMessages)) {
            // 使用全局滚动函数
            if (window.ensureScrollToBottom) {
                // 延迟执行，等待内容渲染完成
                setTimeout(() => {
                    window.ensureScrollToBottom(chatMessages);
                }, 10);
                
                // 添加额外的延迟检查，处理可能的渲染延迟
                const delays = [100, 300, 500];
                delays.forEach(delay => {
                    setTimeout(() => {
                        if (this.shouldAutoScroll(chatMessages)) {
                            window.ensureScrollToBottom(chatMessages);
                        }
                    }, delay);
                });
            } else if (window.scrollToBottom) {
                // 使用备用全局滚动函数
                setTimeout(() => {
                    window.scrollToBottom(false); // 使用非平滑滚动，减少视觉干扰
                }, 10);
                
                // 添加额外检查
                setTimeout(() => {
                    if (this.shouldAutoScroll(chatMessages)) {
                        window.scrollToBottom(false);
                    }
                }, 300);
            }
            // 不再使用container.scrollIntoView，避免激进的滚动行为
        }
    }

    // 显示思考框
    show() {
        this.container.style.display = 'block';
        
        // 根据折叠状态设置内容显示
        if (this.isCollapsed) {
            this.contentContainer.classList.add('collapsed');
            // 如果有摘要，确保摘要可见
            if (this.hasSummary) {
                this.summaryContainer.style.display = 'block';
            }
        } else {
            this.contentContainer.classList.remove('collapsed');
            // 如果未折叠，隐藏摘要
            this.summaryContainer.style.display = 'none';
        }
        
        // 再次渲染内容，确保内容显示正确
        if (this.content) {
            this.contentContainer.innerHTML = this.md.render(this.content);
            this.applyCodeHighlight();
        }
    }

    // 隐藏思考框
    hide() {
        this.container.style.display = 'none';
    }

    // 清空内容
    clear() {
        this.content = '';
        this.summary = '';
        this.hasSummary = false;
        this.summaryGenerating = false;
        this.contentContainer.innerHTML = '';
        this.summaryContainer.innerHTML = '';
        this.summaryContainer.classList.remove('visible');
        this.hide();
        this.stopTimer();
    }

    // 获取DOM元素
    getElement() {
        return this.container;
    }

    // 标记生成完成
    markGenerationComplete() {
        this.isGenerating = false;
        setTimeout(() => this.checkStopTimer(), 100);
    }
    
    // 生成摘要
    generateSummary() {
        // 设置状态
        this.summaryGenerating = true;
        
        // 避免在内容非常短的情况下生成摘要
        if (this.content.length < 100) {
            this.setSummary(this.content); // 直接使用原内容作为摘要
            return;
        }
        
        // 显示生成中状态
        this.summaryContainer.innerHTML = '<em>生成摘要中...</em>';
        this.summaryContainer.classList.add('visible');
        
        // 调用后端API生成摘要
        fetch('/api/summary/generate_thinking_summary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                thinking_content: this.content,
                model_id: 'grok-2-latest' // 使用grok-2模型
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`网络响应错误(${response.status}): ${text}`);
                });
            }
            
            // 处理流式响应
            const reader = response.body.getReader();
            let receivedSummary = '';
            
            const stream = new ReadableStream({
                start(controller) {
                    function push() {
                        return reader.read().then(({ done, value }) => {
                            if (done) {
                                controller.close();
                                return receivedSummary;
                            }
                            
                            // 处理收到的数据
                            const chunk = new TextDecoder().decode(value);
                            
                            // 尝试直接处理纯文本响应
                            if (chunk.trim() && !chunk.includes('data:')) {
                                receivedSummary += chunk;
                                controller.enqueue(value);
                                return push();
                            }
                            
                            // 处理SSE格式的响应
                            const data = chunk.split('\n\n');
                            
                            for (const item of data) {
                                if (item.startsWith('data:')) {
                                    try {
                                        const jsonData = JSON.parse(item.substring(5).trim());
                                        if (jsonData.content) {
                                            receivedSummary += jsonData.content;
                                        }
                                    } catch (e) {
                                        // 如果不是JSON格式，尝试直接使用内容
                                        const content = item.substring(5).trim();
                                        if (content) {
                                            receivedSummary += content;
                                        }
                                        console.log('收到非JSON数据:', content);
                                    }
                                }
                            }
                            
                            controller.enqueue(value);
                            return push();
                        });
                    }
                    
                    return push();
                }
            });
            
            return new Response(stream).text().then(() => receivedSummary);
        })
        .then(summary => {
            // 流处理完成后设置摘要
            if (summary) {
                this.setSummary(summary);
            } else {
                this.summaryContainer.innerHTML = '<em>摘要生成失败: 未收到有效内容</em>';
                this.summaryGenerating = false;
            }
        })
        .catch(error => {
            console.error('生成摘要错误:', error);
            this.summaryContainer.innerHTML = `<em>摘要生成失败: ${error.message}</em>`;
            this.summaryGenerating = false;
        });
    }
}

// 导出 ReasoningBox 类
export default ReasoningBox; 