/**
 * 移动端响应式交互功能
 * 处理移动设备上的特定交互和布局调整
 */
import { InputToolbar } from './components/input_toolbar.js';
import { showToast } from './utils/toast.js';
import { html2Markdown } from './utils/markdownit.js';
// 保存设备状态
window.isMobile = false;

// 当文档加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 检测是否为移动设备
    window.isMobile = window.innerWidth <= 768;
    
    if (window.isMobile) {
        setupMobileInterface();
        setupMobileCopyButtons(); // 为移动端添加复制按钮
    } else {
        // 如果是电脑端，添加消息复制按钮
        setupDesktopCopyButtons();
    }
    
    // 监听窗口大小变化，动态调整布局
    window.addEventListener('resize', function() {
        const isMobileNow = window.innerWidth <= 768;
        
        // 只有当设备类型变化时才重新设置
        if (window.isMobile !== isMobileNow) {
            if (isMobileNow) {
                setupMobileInterface();
                setupMobileCopyButtons(); // 为移动端添加复制按钮
            } else {
                restoreDesktopInterface();
                // 当从移动端切换到桌面端时，添加复制按钮
                setupDesktopCopyButtons();
            }
            // 更新当前状态
            window.isMobile = isMobileNow;
        } else if (window.isMobile) {
            // 即使设备类型未变化，但在移动设备上调整尺寸时也需要重新计算高度
            adjustMessageAreaHeight();
        }
    });
    
    // 监听输入框聚焦事件，处理键盘弹出
    const userInput = document.getElementById('user-input');
    if (userInput) {
        userInput.addEventListener('focus', function() {
            if (window.isMobile) {
                // 键盘弹出时，滚动到底部并调整高度
                setTimeout(() => {
                    adjustMessageAreaHeight();
                    scrollToBottom();
                }, 300);
            }
        });
        
        userInput.addEventListener('blur', function() {
            if (window.isMobile) {
                // 键盘收起时，调整高度
                setTimeout(() => {
                    adjustMessageAreaHeight();
                }, 300);
            }
        });
    }
    
    // 监听新消息添加
    observeNewMessages();
    
    // 添加触摸滚动隔离
    setupTouchIsolation();
    
    // 调整聊天区域高度
    adjustMessageAreaHeight();
    
    // 添加复制相关的CSS样式
    addCopyStyles();
    
    // 监听版本切换事件
    monitorVersionSwitching();
});

/**
 * 监听新消息的添加并更新复制功能
 */
function observeNewMessages() {
    console.log('开始监听新消息...');
    
    // 获取消息容器
    const messagesContainer = document.querySelector('.chat-messages');
    if (!messagesContainer) {
        console.error('未找到消息容器，无法监听新消息');
        return;
    }
    
    // 创建一个MutationObserver实例
    const observer = new MutationObserver(function(mutations) {
        let hasNewMessages = false;
        let newAssistantMessages = [];
        
        // 检查是否有新消息添加
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                    const node = mutation.addedNodes[i];
                    if (node.nodeType === 1) { // 元素节点
                        if (node.classList.contains('assistant-message')) {
                            hasNewMessages = true;
                            newAssistantMessages.push(node);
                        } else if (node.classList.contains('user-message')) {
                            hasNewMessages = true;
                        }
                    }
                }
            }
        });
        
        // 如果有新的助手消息，为它们添加复制按钮
        if (newAssistantMessages.length > 0) {
            console.log('检测到新的助手消息，添加复制按钮');
            if (window.isMobile) {
                newAssistantMessages.forEach(addMobileCopyButtonToMessage);
            } else {
                newAssistantMessages.forEach(addCopyButtonToMessage);
            }
        }
    });
    
    // 开始观察消息容器的变化
    observer.observe(messagesContainer, {
        childList: true,      // 观察子节点的添加或删除
        subtree: false        // 不观察所有后代节点
    });
}

/**
 * 为移动端设置消息复制按钮
 * 为所有助手消息添加复制按钮
 */
function setupMobileCopyButtons() {
    if (!window.isMobile) return;
    
    console.log('为移动端设置消息复制按钮...');
    
    // 获取所有助手消息
    const assistantMessages = document.querySelectorAll('.assistant-message');
    
    // 为每个助手消息添加复制按钮
    assistantMessages.forEach(addMobileCopyButtonToMessage);
}

/**
 * 为移动端的单个消息添加复制按钮
 * @param {Element} messageElement - 消息元素
 */
function addMobileCopyButtonToMessage(messageElement) {
    // 检查消息是否已经有复制按钮
    if (messageElement.querySelector('.mobile-copy-button-container')) {
        return;
    }
    
    // 获取消息内容元素
    const messageContent = messageElement.querySelector('.text-content') || 
                         messageElement.querySelector('.message-content');
    
    if (!messageContent) {
        console.error('未找到消息内容元素');
        return;
    }
    
    // 创建复制按钮容器
    const copyButtonContainer = document.createElement('div');
    copyButtonContainer.className = 'mobile-copy-button-container';
    copyButtonContainer.style.display = 'flex';
    copyButtonContainer.style.justifyContent = 'flex-end';
    copyButtonContainer.style.marginTop = '10px';
    
    // 创建复制按钮
    const copyButton = document.createElement('button');
    copyButton.className = 'mobile-copy-button';
    copyButton.innerHTML = '<i class="fas fa-copy"></i>复制';
    
    // 添加点击事件 - 直接复制为Markdown
    copyButton.addEventListener('click', function() {
        // 获取当前显示的内容（考虑版本切换后的实际显示内容）
        const messageContentElement = messageElement.querySelector('.text-content') || 
                                    messageElement.querySelector('.message-content');
        
        // 显示加载状态
        copyButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>复制中...';
        
        // 使用setTimeout让UI有时间更新
        setTimeout(() => {
            // 将HTML转换为Markdown并复制
            const htmlContent = messageContentElement.innerHTML;
            const markdownText = html2Markdown(htmlContent);
            copyToClipboard(markdownText);
            
            // 显示成功提示
            showToast('已复制内容', 'success');
            
            // 添加点击反馈
            copyButton.innerHTML = '<i class="fas fa-check"></i>复制成功';
            copyButton.classList.add('markdown-btn');
            
            // 恢复原始状态
            setTimeout(() => {
                copyButton.innerHTML = '<i class="fas fa-copy"></i>复制';
                copyButton.classList.remove('markdown-btn');
            }, 1500);
        }, 10);
    });
    
    // 将按钮添加到容器
    copyButtonContainer.appendChild(copyButton);
    
    // 将容器添加到消息底部
    messageElement.appendChild(copyButtonContainer);
}

/**
 * 复制到剪贴板函数
 */
function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => {
                console.log('复制成功');
            })
            .catch(err => {
                console.error('Clipboard API失败:', err);
                // 失败时尝试备选方法
                fallbackCopy(text);
            });
    } else {
        // 使用备选方法
        fallbackCopy(text);
    }
}

/**
 * 备选复制方法
 */
function fallbackCopy(text) {
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        // 确保textarea在视口内但不可见
        textarea.style.position = 'fixed';
        textarea.style.left = '0';
        textarea.style.top = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (successful) {
            console.log('备选方法复制成功');
        } else {
            console.error('备选方法复制失败');
            showToast('复制失败', 'error');
        }
    } catch (e) {
        console.error('复制出错:', e);
        showToast('复制失败', 'error');
    }
}

/**
 * 设置移动端界面
 * 添加汉堡菜单、遮罩层等移动端特有元素
 */
function setupMobileInterface() {
    // 1. 创建汉堡菜单按钮
    if (!document.querySelector('.menu-toggle')) {
        const menuToggle = document.createElement('button');
        menuToggle.className = 'menu-toggle';
        menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
        menuToggle.setAttribute('aria-label', '菜单');
        
        // 添加到页面
        const chatHeader = document.querySelector('.chat-header');
        chatHeader.insertBefore(menuToggle, chatHeader.firstChild);
        
        // 添加点击事件
        menuToggle.addEventListener('click', toggleSidebar);
    }
    
    // 2. 创建侧边栏遮罩层
    if (!document.querySelector('.sidebar-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
        
        // 添加点击事件
        overlay.addEventListener('click', toggleSidebar);
    }
    
    // 3. 调整消息区域的高度
    adjustMessageAreaHeight();
    
    // 4. 确保侧边栏初始状态为隐藏
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.remove('show');
    
    // 5. 优化移动端输入体验
    optimizeMobileInput();
    
    // 6. 优化移动端模型设置显示
    optimizeMobileModelSettings();
    
    // 7. 设置系统提示词切换功能
    setupSystemPromptToggle();
    
    // 8. 设置模态框层级处理
    setupModalLayerHandling();
    
    // 9. 优化选择框和下拉菜单
    optimizeSelects();
    
    // 10. 设置下拉刷新功能
    setupPullToRefresh();
}

/**
 * 恢复桌面端界面
 * 移除移动端特有元素，恢复桌面布局
 */
function restoreDesktopInterface() {
    // 1. 移除汉堡菜单按钮
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        menuToggle.remove();
    }
    
    // 2. 移除遮罩层
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) {
        overlay.remove();
    }
    
    // 3. 恢复侧边栏默认状态
    const sidebar = document.querySelector('.sidebar');
    sidebar.style.left = '0';
    sidebar.classList.remove('show');
    
    // 4. 恢复输入区域默认状态
    restoreDesktopInput();
    
    // 5. 恢复模型设置默认状态
    restoreDesktopModelSettings();
    
    // 6. 恢复系统提示词显示
    restoreSystemPromptDisplay();
    
    // 7. 恢复选择框和下拉菜单
    restoreSelects();
}

/**
 * 切换侧边栏显示/隐藏
 */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.toggle('show');
    overlay.classList.toggle('show');
    
    // 隐藏系统提示词
    hideSystemPrompt();
}

/**
 * 调整消息区域的高度
 * 根据当前设备尺寸动态计算聊天消息区域的高度
 */
function adjustMessageAreaHeight() {
    if (!window.isMobile) return;
    
    // 使用flex布局自动调整高度
    const chatMessages = document.querySelector('.chat-messages');
    const inputContainer = document.querySelector('.message-input-container');
    
    if (chatMessages && inputContainer) {
        // 获取输入框的实际高度
        const inputHeight = inputContainer.offsetHeight;
        
        // 为消息区域设置更大的底部边距，确保滚动时内容不会被输入框遮挡
        chatMessages.style.marginBottom = `${inputHeight + 20}px`;
        
        // 添加滚动边界处理，防止滚动穿透
        chatMessages.style.overscrollBehavior = 'contain';
        
        // 确保消息区域的滚动位置正确
        chatMessages.scrollTop = chatMessages.scrollTop;
    }
}

/**
 * 优化移动端输入体验
 */
function optimizeMobileInput() {
    // 调整文本区域自动增长高度的最大值
    const userInput = document.getElementById('user-input');
    if (userInput) {
        userInput.style.maxHeight = '100px';
        
        // 在输入时自动调整高度
        userInput.addEventListener('input', function() {
            adjustMessageAreaHeight();
        });
    }
    
    // 点击发送按钮后自动隐藏键盘
    const sendButton = document.getElementById('send-button');
    if (sendButton) {
        const originalClickHandler = sendButton.onclick;
        
        sendButton.onclick = function(e) {
            if (originalClickHandler) {
                originalClickHandler.call(this, e);
            }
            
            // 隐藏键盘
            document.activeElement.blur();
        };
    }
}

/**
 * 恢复桌面端输入区域
 */
function restoreDesktopInput() {
    const userInput = document.getElementById('user-input');
    if (userInput) {
        userInput.style.maxHeight = '';
    }
    
    // 恢复消息区域边距
    const chatMessages = document.querySelector('.chat-messages');
    if (chatMessages) {
        chatMessages.style.marginBottom = '';
    }
}

/**
 * 优化移动端模型设置显示
 */
function optimizeMobileModelSettings() {
    // 当模型设置渲染器存在时进行优化
    if (window.modelSettingRenderer) {
        // 调整模型设置样式
        const modelSettingContainer = document.querySelector('.model-setting-container');
        if (modelSettingContainer) {
            // 简化移动端上的显示
            const sliders = modelSettingContainer.querySelectorAll('.slider-container');
            sliders.forEach(slider => {
                // 调整滑块宽度
                slider.style.width = '100%';
            });
        }
    }
    
    // 增强视觉开关层级调整
    const enhancedVisualToggle = document.querySelector('.enhanced-visual-toggle-container');
    if (enhancedVisualToggle) {
        enhancedVisualToggle.style.zIndex = '30';
        
        // 调整位置，避免与输入框重叠
        enhancedVisualToggle.style.bottom = '80px';
    }
}

/**
 * 恢复桌面端模型设置
 */
function restoreDesktopModelSettings() {
    if (window.modelSettingRenderer) {
        const modelSettingContainer = document.querySelector('.model-setting-container');
        if (modelSettingContainer) {
            const sliders = modelSettingContainer.querySelectorAll('.slider-container');
            sliders.forEach(slider => {
                slider.style.width = '';
            });
        }
    }
    
    // 恢复增强视觉开关层级
    const enhancedVisualToggle = document.querySelector('.enhanced-visual-toggle-container');
    if (enhancedVisualToggle) {
        enhancedVisualToggle.style.zIndex = '';
        enhancedVisualToggle.style.bottom = '';
    }
}

/**
 * 优化选择框和下拉菜单
 */
function optimizeSelects() {
    // 优化模型选择器
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) {
        // 确保选择框的z-index设置正确
        modelSelect.style.zIndex = '200';
        
        // 添加聚焦和失焦事件来管理z-index
        modelSelect.addEventListener('focus', function() {
            this.style.zIndex = '300';
        });
        
        modelSelect.addEventListener('blur', function() {
            setTimeout(() => {
                this.style.zIndex = '200';
            }, 300); // 延迟恢复z-index，确保下拉菜单有时间关闭
        });
        
        // 简化模型名称但保留完整内容
        Array.from(modelSelect.options).forEach(option => {
            // 保存原始文本以便还原
            if (!option.getAttribute('data-original-text') && option.text) {
                option.setAttribute('data-original-text', option.text);
            }
        });
        
        // 添加 CSS 类
        modelSelect.classList.add('model-select-element');
    }
}

/**
 * 恢复选择框和下拉菜单
 */
function restoreSelects() {
    // 恢复模型选择器
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) {
        // 移除移动端样式
        modelSelect.style.zIndex = '';
        modelSelect.classList.remove('model-select-element');
        
        // 移除事件监听器
        const newModelSelect = modelSelect.cloneNode(true);
        modelSelect.parentNode.replaceChild(newModelSelect, modelSelect);
        
        // 恢复原始文本
        Array.from(newModelSelect.options).forEach(option => {
            const originalText = option.getAttribute('data-original-text');
            if (originalText) {
                option.text = originalText;
            }
        });
    }
}

/**
 * 设置系统提示词切换功能
 * 在移动端将系统提示词改为点击按钮显示/隐藏
 */
function setupSystemPromptToggle() {
    const promptHeader = document.querySelector('.system-prompt-header');
    const systemPrompt = document.getElementById('system-prompt');
    
    if (promptHeader && systemPrompt) {
        // 保留原始标题文本，但不再修改显示内容
        const titleSpan = promptHeader.querySelector('span');
        if (titleSpan && !titleSpan.getAttribute('data-original-text')) {
            titleSpan.setAttribute('data-original-text', titleSpan.textContent);
            // 不再修改文本内容，保持原始文本
        }
        
        // 移除现有的事件监听器
        const newPromptHeader = promptHeader.cloneNode(true);
        promptHeader.parentNode.replaceChild(newPromptHeader, promptHeader);
        
        // 移除现有的显示类
        systemPrompt.classList.remove('show');
        
        // 设置系统提示词样式
        systemPrompt.style.position = 'absolute';
        systemPrompt.style.maxHeight = '150px';
        
        // 添加点击事件，切换系统提示词显示/隐藏
        newPromptHeader.addEventListener('click', function(e) {
            e.stopPropagation(); // 防止点击事件冒泡
            
            // 隐藏其他弹出元素
            hideAllDropdowns();
            
            // 切换显示状态
            systemPrompt.classList.toggle('show');
            
            // 当显示系统提示词时
            if (systemPrompt.classList.contains('show')) {
                // 计算位置，确保不超出屏幕
                const containerRect = this.getBoundingClientRect();
                
                // 更靠右的位置计算
                const targetLeft = containerRect.left + containerRect.width - 130; // 让它右对齐但留出一点空间
                const safeLeft = Math.max(10, Math.min(
                    targetLeft,
                    window.innerWidth - 270 // 260px宽度 + 10px边距
                ));
                
                systemPrompt.style.left = `${safeLeft}px`;
                
                // 聚焦输入框
                systemPrompt.focus();
                
                // 点击其他区域时隐藏系统提示词
                document.addEventListener('click', hideSystemPrompt);
            } else {
                document.removeEventListener('click', hideSystemPrompt);
            }
        });
        
        // 防止系统提示词点击事件冒泡
        systemPrompt.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
}

/**
 * 恢复系统提示词在桌面端的显示方式
 */
function restoreSystemPromptDisplay() {
    const systemPrompt = document.getElementById('system-prompt');
    const promptHeader = document.querySelector('.system-prompt-header');
    
    if (systemPrompt) {
        // 移除移动端特有的类和事件
        systemPrompt.classList.remove('show');
        document.removeEventListener('click', hideSystemPrompt);
        
        // 恢复样式
        systemPrompt.style.position = '';
        systemPrompt.style.width = '';
        systemPrompt.style.left = '';
    }
    
    // 重新添加头部点击事件
    if (promptHeader) {
        const newPromptHeader = promptHeader.cloneNode(true);
        promptHeader.parentNode.replaceChild(newPromptHeader, promptHeader);
        
        // 恢复桌面版点击事件
        newPromptHeader.addEventListener('click', function() {
            const container = document.querySelector('.system-prompt-container');
            const textarea = document.getElementById('system-prompt');
            
            if (container) {
                container.classList.toggle('collapsed');
            }
            
            if (textarea) {
                textarea.classList.toggle('collapsed');
                textarea.style.height = textarea.classList.contains('collapsed') ? 
                    '0' : (textarea.scrollHeight + 'px');
                
                // 如果展开，则聚焦
                if (!textarea.classList.contains('collapsed')) {
                    textarea.focus();
                }
            }
        });
    }
}

/**
 * 隐藏系统提示词
 * 点击文档其他区域时调用
 */
function hideSystemPrompt(e) {
    const systemPrompt = document.getElementById('system-prompt');
    const promptHeader = document.querySelector('.system-prompt-header');
    
    // 如果点击的不是系统提示词也不是它的头部，则隐藏
    if (systemPrompt && 
        (!e || 
        (e.target !== systemPrompt && 
         e.target !== promptHeader && 
         !promptHeader.contains(e.target)))) {
        
        systemPrompt.classList.remove('show');
        document.removeEventListener('click', hideSystemPrompt);
    }
}

/**
 * 隐藏所有下拉菜单
 * 用于在打开一个下拉菜单前隐藏其他下拉菜单
 */
function hideAllDropdowns() {
    // 隐藏系统提示词
    hideSystemPrompt();
    
    // 隐藏用户配置下拉菜单
    const profileDropdown = document.querySelector('.profile-dropdown');
    if (profileDropdown && window.getComputedStyle(profileDropdown).display !== 'none') {
        profileDropdown.style.display = 'none';
    }
}

/**
 * 设置模态框层级处理
 * 确保模态框和侧边栏能正确覆盖增强视觉分析开关
 */
function setupModalLayerHandling() {
    // 监听模型设置栏的显示/隐藏
    const modelSettingObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                // 当模型设置栏显示时，调整增强视觉分析开关的层级
                const modelSettingBar = document.querySelector('.model-setting-bar');
                const enhancedVisualToggle = document.querySelector('.enhanced-visual-toggle-container');
                
                if (modelSettingBar && enhancedVisualToggle) {
                    if (modelSettingBar.style.display !== 'none') {
                        // 模型设置栏显示时，隐藏增强视觉分析开关
                        enhancedVisualToggle.style.visibility = 'hidden';
                    } else {
                        // 模型设置栏隐藏时，显示增强视觉分析开关
                        enhancedVisualToggle.style.visibility = 'visible';
                    }
                }
            }
        });
    });
    
    const modelSettingBar = document.querySelector('.model-setting-bar');
    if (modelSettingBar) {
        modelSettingObserver.observe(modelSettingBar, { attributes: true });
    }
    
    // 监听用户下拉菜单点击
    const userProfileBtn = document.querySelector('.user-profile-btn');
    if (userProfileBtn) {
        userProfileBtn.addEventListener('click', function() {
            // 隐藏其他下拉元素
            hideSystemPrompt();
            
            // 确保增强视觉分析开关不遮挡下拉菜单
            const enhancedVisualToggle = document.querySelector('.enhanced-visual-toggle-container');
            if (enhancedVisualToggle) {
                enhancedVisualToggle.style.zIndex = '20';
            }
        });
    }
}

/**
 * 滚动消息区域到底部
 */
function scrollToBottom() {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

/**
 * 移动端响应式功能测试
 * 此函数仅用于测试移动端响应式功能是否正常工作
 */
function testMobileResponsive() {
    // 创建测试报告
    const report = {
        isMobile: window.isMobile,
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight
        },
        elements: {}
    };
    
    // 检测DOM元素是否存在
    const elementsToCheck = [
        '.sidebar', 
        '.chat-container', 
        '.chat-header', 
        '.chat-messages', 
        '.message-input-container',
        '.menu-toggle',
        '.sidebar-overlay',
        '.system-prompt-container',
        '.user-profile-container',
        '.enhanced-visual-toggle-container'
    ];
    
    elementsToCheck.forEach(selector => {
        const element = document.querySelector(selector);
        report.elements[selector] = {
            exists: !!element,
            visible: element ? window.getComputedStyle(element).display !== 'none' : false
        };
        
        if (element) {
            report.elements[selector].dimensions = {
                width: element.offsetWidth,
                height: element.offsetHeight
            };
            
            // 检查z-index
            const zIndex = window.getComputedStyle(element).zIndex;
            if (zIndex !== 'auto') {
                report.elements[selector].zIndex = zIndex;
            }
        }
    });
    
    // 检查modelSettingRenderer
    report.modelSettingRenderer = {
        exists: !!window.modelSettingRenderer
    };
    
    // 输出测试报告到控制台
    console.log('移动端响应式功能测试报告:', report);
    
    // 返回测试报告
    return report;
}

/**
 * 当键盘显示或隐藏时调整界面
 * 主要针对移动端键盘弹出时的界面调整
 */
window.addEventListener('resize', function() {
    // 在移动设备上，键盘弹出时会改变视口高度
    if (window.isMobile) {
        adjustMessageAreaHeight();
    }
});

/**
 * 设置下拉刷新功能
 * 允许用户在移动端通过下拉来刷新聊天
 */
function setupPullToRefresh() {
    const chatHeader = document.querySelector('.chat-header');
    if (!chatHeader) return;

    // 创建下拉刷新指示器
    const refreshIndicator = document.createElement('div');
    refreshIndicator.className = 'pull-refresh-indicator';
    refreshIndicator.innerHTML = '<i class="fas fa-sync-alt"></i>';
    refreshIndicator.style.display = 'none';
    chatHeader.insertAdjacentElement('afterend', refreshIndicator);
    
    let touchStartY = 0;
    let touchEndY = 0;
    let pullDistance = 0;
    let isPulling = false;
    let refreshThreshold = 80; // 适当减小触发刷新的阈值
    
    // 触摸开始事件
    chatHeader.addEventListener('touchstart', function(e) {
        // 检查触摸事件是否发生在model-select或其子元素上
        const modelSelect = document.getElementById('model-select');
        const modelSelector = document.querySelector('.model-selector');
        // 检查系统提示词相关元素
        const systemPrompt = document.getElementById('system-prompt');
        const systemPromptHeader = document.getElementById('system-prompt-header');
        const systemPromptContainer = document.querySelector('.system-prompt-container');
        
        // 如果触摸开始于model-select或其父容器，则不触发下拉刷新
        if (modelSelect && (modelSelect.contains(e.target) || e.target === modelSelect || 
            (modelSelector && (modelSelector.contains(e.target) || e.target === modelSelector)))) {
            isPulling = false;
            return;
        }
        
        // 如果触摸开始于系统提示词相关元素，则不触发下拉刷新
        if ((systemPrompt && (systemPrompt.contains(e.target) || e.target === systemPrompt)) ||
            (systemPromptHeader && (systemPromptHeader.contains(e.target) || e.target === systemPromptHeader)) ||
            (systemPromptContainer && (systemPromptContainer.contains(e.target) || e.target === systemPromptContainer))) {
            isPulling = false;
            return;
        }
        
        // 在header区域允许下拉刷新
        isPulling = true;
        touchStartY = e.touches[0].clientY;
        refreshIndicator.style.transform = 'translateY(-100%)';
        refreshIndicator.style.display = 'flex';
    });
    
    // 触摸移动事件
    chatHeader.addEventListener('touchmove', function(e) {
        if (!isPulling) return;
        
        // 再次检查，确保即使手指移动到model-select区域也不触发刷新
        const modelSelect = document.getElementById('model-select');
        const modelSelector = document.querySelector('.model-selector');
        // 检查系统提示词相关元素
        const systemPrompt = document.getElementById('system-prompt');
        const systemPromptHeader = document.getElementById('system-prompt-header');
        const systemPromptContainer = document.querySelector('.system-prompt-container');
        
        if (modelSelect && (modelSelect.contains(e.target) || e.target === modelSelect || 
            (modelSelector && (modelSelector.contains(e.target) || e.target === modelSelector)))) {
            isPulling = false;
            return;
        }
        
        // 如果手指移动到系统提示词相关元素，则不触发下拉刷新
        if ((systemPrompt && (systemPrompt.contains(e.target) || e.target === systemPrompt)) ||
            (systemPromptHeader && (systemPromptHeader.contains(e.target) || e.target === systemPromptHeader)) ||
            (systemPromptContainer && (systemPromptContainer.contains(e.target) || e.target === systemPromptContainer))) {
            isPulling = false;
            return;
        }
        
        touchEndY = e.touches[0].clientY;
        pullDistance = touchEndY - touchStartY;
        
        // 只有下拉时才处理（pullDistance > 0）
        if (pullDistance > 0) {
            // 计算下拉距离并应用到指示器
            let translateY = Math.min(pullDistance * 0.5, refreshThreshold) - 100;
            refreshIndicator.style.transform = `translateY(${translateY}%)`;
            
            // 阻止默认滚动行为，让下拉更流畅
            e.preventDefault();
            
            // 当下拉距离超过阈值时，更新指示器样式
            if (pullDistance > refreshThreshold) {
                refreshIndicator.classList.add('ready');
            } else {
                refreshIndicator.classList.remove('ready');
            }
        }
    });
    
    // 触摸结束事件，也监听整个document，以防止手指滑出header区域
    document.addEventListener('touchend', function(e) {
        if (!isPulling) return;
        
        if (pullDistance > refreshThreshold) {
            // 触发刷新
            refreshContent();
        } else {
            // 重置下拉指示器
            resetPullIndicator();
        }
        
        isPulling = false;
    });
    
    // 添加touchcancel事件处理，处理意外的触摸取消
    document.addEventListener('touchcancel', function() {
        if (isPulling) {
            resetPullIndicator();
            isPulling = false;
        }
    });
    
    // 刷新内容的函数
    function refreshContent() {
        // 显示加载中状态
        refreshIndicator.classList.add('refreshing');
        refreshIndicator.querySelector('i').classList.add('fa-spin');
        
        // 这里执行刷新操作，例如重新加载当前会话
        // 模拟异步操作
        setTimeout(() => {
            // 重新加载当前会话
            if (window.currentConversationId) {
                // 如果使用了对话ID，则加载特定对话
                window.loadConversation(window.currentConversationId);
            } else {
                // 否则重新加载页面
                window.location.reload();
            }
            
            // 刷新完成后重置
            resetPullIndicator();
        }, 1000);
    }
    
    // 重置下拉指示器
    function resetPullIndicator() {
        refreshIndicator.style.transform = 'translateY(-100%)';
        refreshIndicator.classList.remove('ready', 'refreshing');
        refreshIndicator.querySelector('i').classList.remove('fa-spin');
        
        // 延迟后隐藏指示器
        setTimeout(() => {
            refreshIndicator.style.display = 'none';
        }, 300);
    }
}

/**
 * 设置移动端触摸与滚动隔离
 * 防止不同区域滚动干扰
 */
function setupTouchIsolation() {
    if (!window.isMobile) return;
    
    // 获取需要隔离滚动的元素
    const messageInputContainer = document.getElementById('message-input-container');
    const systemPrompt = document.getElementById('system-prompt');
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    
    // 设置输入区域的滚动隔离
    if (messageInputContainer) {
        messageInputContainer.addEventListener('touchmove', function(e) {
            // 阻止事件冒泡，防止触发chat-messages的滚动
            e.stopPropagation();
        }, { passive: false });
    }
    
    // 设置系统提示词滚动隔离
    if (systemPrompt) {
        systemPrompt.addEventListener('touchstart', function(e) {
            // 阻止事件冒泡，防止触发下拉刷新
            e.stopPropagation();
        }, { passive: false });
        
        systemPrompt.addEventListener('touchmove', function(e) {
            // 检查是否在边界滚动
            const scrollTop = this.scrollTop;
            const scrollHeight = this.scrollHeight;
            const height = this.clientHeight;
            const isAtTop = scrollTop <= 0;
            const isAtBottom = scrollTop + height >= scrollHeight;
            
            // 只有当滚动不在内部区域且继续朝那个方向滚动时才阻止默认行为
            if ((isAtTop && e.touches[0].clientY > e.touches[0].clientY) || 
                (isAtBottom && e.touches[0].clientY < e.touches[0].clientY)) {
                e.preventDefault();
            }
            
            // 阻止事件冒泡，防止触发chat-messages的滚动
            e.stopPropagation();
        }, { passive: false });
    }
    
    // 设置用户输入框的滚动隔离
    if (userInput) {
        userInput.addEventListener('touchmove', function(e) {
            // 阻止事件冒泡，防止触发chat-messages的滚动
            e.stopPropagation();
        }, { passive: false });
        
        userInput.addEventListener('scroll', function(e) {
            // 阻止滚动事件冒泡
            e.stopPropagation();
        }, { passive: false });
    }
}

/**
 * 添加复制相关的CSS样式
 */
function addCopyStyles() {
    // 创建样式元素
    const style = document.createElement('style');
    style.textContent = `
        /* 复制选项菜单样式 */
        .mobile-copy-options-menu,
        .copy-options-menu {
            animation: fadeIn 0.2s ease-out;
            border: 1px solid #e0e0e0;
        }
        
        /* 复制选项样式 */
        .copy-option {
            transition: background-color 0.2s ease;
        }
        
        .copy-option:hover {
            background-color: #f0f0f0;
        }
        
        /* 移动端复制按钮样式 */
        .mobile-copy-button {
            transition: transform 0.2s, background-color 0.2s;
        }
        
        .mobile-copy-button:active {
            transform: scale(0.95);
        }
        
        /* 电脑端复制按钮样式 */
        .desktop-copy-button-container {
            margin-top: 10px;
            display: flex;
            justify-content: flex-end;
        }
        
        .desktop-copy-button {
            padding: 6px 12px;
            font-size: 12px;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            opacity: 0.8;
        }
        
        .desktop-copy-button:hover {
            opacity: 1;
            transform: translateY(-1px);
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .desktop-copy-button i {
            margin-right: 5px;
        }
        
        /* 复制成功状态 */
        .desktop-copy-button.copy-success {
            animation: pulse 0.3s ease;
        }
        
        /* 暗色模式下复制成功 */
        body.dark-theme .desktop-copy-button.copy-success {
            background-color: #38a169 !important;
            border-color: #2f855a !important;
            color: white !important;
        }
        
        /* 亮色模式下复制成功 */
        body:not(.dark-theme) .desktop-copy-button.copy-success {
            background-color: #9ae6b4 !important;
            border-color: #68d391 !important;
            color: #22543d !important;
        }
        
        /* 暗色模式样式 */
        body.dark-theme .desktop-copy-button {
            background-color: #2d3748;
            color: #e2e8f0;
            border: 1px solid #4a5568;
        }
        
        body.dark-theme .desktop-copy-button:hover {
            background-color: #3a4a61;
        }
        
        /* 亮色模式样式 */
        body:not(.dark-theme) .desktop-copy-button {
            background-color: #f8fafc;
            color: #4a5568;
            border: 1px solid #e2e8f0;
        }
        
        body:not(.dark-theme) .desktop-copy-button:hover {
            background-color: #e2e8f0;
        }
        
        /* 动画定义 */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.8); }
            to { opacity: 1; transform: scale(1); }
        }
        
        @keyframes flash {
            0% { background-color: transparent; }
            50% { background-color: rgba(66, 133, 244, 0.2); }
            100% { background-color: transparent; }
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
    `;
    
    // 添加到文档头部
    document.head.appendChild(style);
}

/**
 * 为电脑端设置消息复制按钮
 * 为所有助手消息添加复制按钮
 */
function setupDesktopCopyButtons() {
    if (window.isMobile) return;
    
    console.log('为电脑端设置消息复制按钮...');
    
    // 获取所有助手消息
    const assistantMessages = document.querySelectorAll('.assistant-message');
    
    // 为每个助手消息添加复制按钮
    assistantMessages.forEach(addCopyButtonToMessage);
}

/**
 * 为单个消息添加复制按钮
 * @param {Element} messageElement - 消息元素
 */
function addCopyButtonToMessage(messageElement) {
    // 检查消息是否已经有复制按钮
    if (messageElement.querySelector('.desktop-copy-button-container')) {
        return;
    }
    
    // 获取消息内容元素
    const messageContent = messageElement.querySelector('.text-content') || 
                         messageElement.querySelector('.message-content');
    
    if (!messageContent) {
        console.error('未找到消息内容元素');
        return;
    }
    
    // 创建复制按钮容器
    const copyButtonContainer = document.createElement('div');
    copyButtonContainer.className = 'desktop-copy-button-container';
    
    // 创建复制为Markdown的按钮
    const copyMarkdownButton = document.createElement('button');
    copyMarkdownButton.className = 'desktop-copy-button';
    copyMarkdownButton.innerHTML = '<i class="fas fa-copy"></i>复制为Markdown';
    
    // 添加点击事件
    copyMarkdownButton.addEventListener('click', function() {
        // 获取当前显示的内容（考虑版本切换后的实际显示内容）
        const messageContentElement = messageElement.querySelector('.text-content') || 
                                    messageElement.querySelector('.message-content');
        
        // 获取HTML内容
        const htmlContent = messageContentElement.innerHTML;
        
        // 转换为Markdown并复制
        const markdownText = html2Markdown(htmlContent);
        
        // 使用之前定义的复制函数
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(markdownText)
                .then(() => {
                    console.log('复制成功');
                })
                .catch(err => {
                    console.error('Clipboard API失败:', err);
                    // 失败时尝试备选方法
                    fallbackCopy(markdownText);
                });
        } else {
            // 使用备选方法
            fallbackCopy(markdownText);
        }
        
        // 显示成功提示
        showToast('已复制为Markdown格式', 'success');
        
        // 添加点击反馈
        this.classList.add('copy-success');
        this.innerHTML = '<i class="fas fa-check"></i>复制成功';
        
        // 恢复原始状态
        setTimeout(() => {
            this.classList.remove('copy-success');
            this.innerHTML = '<i class="fas fa-copy"></i>复制为Markdown';
        }, 1500);
    });
    
    // 将按钮添加到容器
    copyButtonContainer.appendChild(copyMarkdownButton);
    
    // 将容器添加到消息底部
    messageElement.appendChild(copyButtonContainer);
}

/**
 * 监听版本切换事件，确保复制按钮获取正确的版本内容
 */
function monitorVersionSwitching() {
    // 监听整个聊天区域的点击事件，捕获版本切换按钮的点击
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    chatMessages.addEventListener('click', function(e) {
        // 检查点击的是否是版本切换按钮
        const target = e.target;
        if (target && (target.classList.contains('version-btn') || target.closest('.version-btn'))) {
            // 找到按钮所在的消息元素
            const messageActions = target.closest('.message-actions');
            if (!messageActions) return;
            
            const messageElement = messageActions.closest('.message-wrapper');
            if (!messageElement) return;
            
            // 不再移除和添加复制按钮，这些操作在switchVersion函数中处理
            console.log('检测到版本切换按钮点击');
            
            // 如果需要，在这里可以添加其他代码来处理版本切换按钮点击事件
        }
    });
}

// 暴露公共方法
export { toggleSidebar, adjustMessageAreaHeight, scrollToBottom, testMobileResponsive, hideAllDropdowns, setupPullToRefresh, setupDesktopCopyButtons, setupMobileCopyButtons }; 