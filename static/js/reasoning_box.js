class ReasoningBox {
    constructor(messageContent, md) {
        this.container = document.createElement('div');
        this.container.className = 'reasoning-box';
        this.container.style.display = 'none';
        this.container.style.order = '-1'; // 确保思考框始终在最前
        this.messageContent = messageContent;
        this.md = md;
        this.content = '';
        this.isCollapsed = false;
        
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
        
        // 将头部和内容容器添加到主容器
        this.container.appendChild(this.headerContainer);
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
        }
    }

    // 添加思考内容
    appendContent(content) {
        this.content += content;
        this.lastContentUpdate = Date.now();
        this.isGenerating = true;
        if (!this.startTime) {
            this.startTimer();
            this.titleSpan.textContent = '思考中';  // 确保显示"思考中"
        }
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
        }
    }

    // 获取思考内容
    getContent() {
        return this.content;
    }

    // 切换收起/展开状态
    toggle() {
        this.isCollapsed = !this.isCollapsed;
        this.toggleButton.innerHTML = this.isCollapsed ? '展开' : '收起';
        this.contentContainer.style.display = this.isCollapsed ? 'none' : 'block';
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
        const codeBlocks = this.contentContainer.querySelectorAll('pre code');
        codeBlocks.forEach(block => {
            hljs.highlightElement(block);
        });
    }

    // 如果需要，滚动到可见区域
    scrollIntoViewIfNeeded() {
        const chatMessages = document.getElementById('chat-messages');
        if (this.shouldAutoScroll(chatMessages)) {
            this.container.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }

    // 判断是否应该自动滚动
    shouldAutoScroll(container) {
        const threshold = 100;
        return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    }

    // 显示思考框
    show() {
        this.container.style.display = 'block';
        this.contentContainer.style.display = this.isCollapsed ? 'none' : 'block';
    }

    // 隐藏思考框
    hide() {
        this.container.style.display = 'none';
    }

    // 清空内容
    clear() {
        this.content = '';
        this.contentContainer.innerHTML = '';
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
}

// 导出 ReasoningBox 类
export default ReasoningBox; 