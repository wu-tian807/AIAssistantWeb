// 配置 markdown-it 实例，启用各种功能
import { initMarkdownit ,applyCodeHighlight, initializeCodeBlocks} from "./utils/markdownit.js";
import { Uploader } from "./utils/attachments/uploader/Uploader.js";
import { AttachmentRenderer } from './utils/attachments/AttachmentRenderer.js';
import { imageUploader } from './utils/attachments/uploader/ImageUploader.js';
import { showToast, confirmDialog,showError } from './utils/toast.js';
import {IconRenderer} from './iconRenderer.js';
import { getLastAssistantModel,updateModelSelect } from './utils/model_selector/modelSelect.js';
import { initializeUserProfile ,initializeTheme} from './user_profiles/userDropdownHandler.js';
import { ModelSettingRenderer } from './model_setting_bar/modelSettingRenderer.js';
import { AttachmentTypeLoader } from "./utils/attachments/types.js";
import ReasoningBox from './reasoning_box.js';
import { ToolBox } from './tools/tool_box.js';
// 导入移动端响应式功能
import { adjustMessageAreaHeight, testMobileResponsive, hideAllDropdowns } from './mobile-responsive.js';

const md = initMarkdownit();
// 在文件开头添加新的变量
let conversations = [];
export let currentConversationId = null;
// 存储聊天消息历史
let messages = [];
// 当前的流式响应对象
let currentReader = null;
// 添加全局标志，用于表示是否手动停止生成
window.generationStopped = false;
// 在脚本开始处添加全局变量定义
window.ReasoningBoxInstance = null; // 添加全局实例变量
// 改进滚动检测和控制
let userScrolling = false;
let lastScrollTop = 0;
let scrollTimeout = null;
// 添加内容生成状态标志
window.isGenerating = false;

// 获取 DOM 元素
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const attachmentPreview = document.getElementById('attachment-preview');

// 检查是否可以发送消息的函数
export function canSendMessage() {
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    
    // 检查是否有内容或附件
    const hasContent = userInput.value.trim().length > 0 || hasAttachments();
    
    // 检查是否正在生成
    const isGenerating = window.isGenerating;
    
    // 检查最后一条消息是否是错误状态
    const messages = document.querySelectorAll('.message');
    const lastMessage = messages[messages.length - 1];
    const isLastMessageError = lastMessage && lastMessage.classList.contains('error');
    
    // 如果最后一条消息是错误状态，禁用发送按钮
    if (isLastMessageError) {
        sendButton.disabled = true;
        return false;
    }
    
    // 更新发送按钮状态
    sendButton.disabled = !hasContent || isGenerating;
    
    return hasContent && !isGenerating;
}

// 监听输入框变化，控制发送按钮状态
userInput.addEventListener('input', () => {
    if(sendButton.classList.contains('stop')){
        sendButton.disabled = false;
    }else{
        sendButton.disabled = !canSendMessage();
    }
});

// 创建 MutationObserver 监听预览框的变化
const previewObserver = new MutationObserver(() => {
    if(sendButton.classList.contains('stop')){
        sendButton.disabled = false;
    }else{
        sendButton.disabled = !canSendMessage();
    }
});

// 开始观察预览框的变化
if (attachmentPreview) {
    previewObserver.observe(attachmentPreview, {
        childList: true,
        subtree: true
    });
}

// 监听回车键发送消息
userInput.addEventListener('keydown', (e) => {
    if(window.isMobile){
        return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendButton.classList.contains('stop')) {
            sendMessage();
        }else{
            stopGeneration();
        }
    }
});

// 发送按钮点击事件
sendButton.addEventListener('click', () => {
    if (sendButton.classList.contains('stop')) {
        stopGeneration();
    } else {
        sendMessage();
    }
});

// 修改 stopGeneration 函数
function stopGeneration() {
    console.log("===== 进入stopGeneration函数 =====");
    console.log("当前window.isGenerating状态:", window.isGenerating);
    console.log("当前generationStopped状态:", generationStopped);
    console.log("当前currentReader:", currentReader);
    
    if (window.isGenerating) {
        console.log("设置generationStopped为true");
        window.generationStopped = true;
        const currentConversation = conversations.find(c => c.id === currentConversationId);
        
        // 保存当前未完成的思考框内容
        const messageDiv = document.querySelector('.message.assistant-message:last-child');
        if (messageDiv) {
            const messageContent = messageDiv.querySelector('.message-content');
            const reasoningBox = messageContent.querySelector('.reasoning-box');
            
            if (reasoningBox && window.ReasoningBoxInstance) {
                // 标记思考框为已完成
                window.ReasoningBoxInstance.markGenerationComplete();
                
                // 获取当前对话
                if (currentConversation && currentConversation.messages.length > 0) {
                    // 获取上一条用户消息的索引
                    const lastUserMessageIndex = currentConversation.messages.length - 1;
                    
                    // 获取思考框的数据
                    const reasoningData = window.ReasoningBoxInstance.getSerializableData();
                    const reasoningContent = reasoningData.reasoning_content;
                    const reasoningSummary = reasoningData.reasoning_summary || extractSummaryFromThinking(reasoningData);
                    const thinkingTime = reasoningData.reasoning_time;
                    
                    if (reasoningContent) {
                        console.log("保存思考内容到对话");
                        // 获取当前选择的模型图标和ID
                        const modelIcon = document.querySelector('#model-select option:checked').getAttribute('data-icon');
                        const selectedModel = document.getElementById('model-select').value;
                        
                        // 直接添加一条助手消息，包含思考内容
                        currentConversation.messages.push({
                            role: "assistant",
                            content: reasoningSummary || "(思考被中断)",  // 使用摘要或默认文本
                            reasoning_content: reasoningContent,
                            reasoning_summary: reasoningSummary,
                            thinking_time: thinkingTime,
                            modelIcon: modelIcon,
                            modelId: selectedModel,
                            versions: [{
                                content: reasoningSummary || "(思考被中断)",
                                reasoning_content: reasoningContent,
                                reasoning_summary: reasoningSummary,
                                thinking_time: thinkingTime,
                                attachments: [],
                                subsequentMessages: [],
                                modelIcon: modelIcon,
                                modelId: selectedModel
                            }],
                            currentVersion: 0,
                            isInterrupted: true  // 标记为被中断的消息
                        });
                        
                        // 更新UI，添加重新生成按钮
                        const messageIndex = currentConversation.messages.length - 1;
                        const messageWrapper = messageDiv.querySelector('.message-wrapper');
                        const messageActions = messageWrapper.querySelector('.message-actions');
                        messageActions.innerHTML = '';
                        createRegenerateButton(messageIndex, messageActions, false);
                        
                        // 保存对话
                        saveConversation(currentConversation.id, 'update');
                    }
                }
            }
        }
        
        if (currentReader) {
            console.log("准备取消currentReader");
            try {
                console.log("执行currentReader.cancel()");
                currentReader.cancel();
                console.log("currentReader.cancel()执行完成");
            } catch (e) {
                console.error("取消reader时出错:", e);
            }
            console.log("设置currentReader为null");
            currentReader = null;
        } else {
            console.log("currentReader为null，无需取消");
        }
        
        // 更新UI状态
        const sendButton = document.getElementById('send-button');
        console.log("更新UI状态");
        // sendButton.textContent = '发送';
        // sendButton.classList.remove('stop');
        // sendButton.disabled = true;
        
        // 找到正在生成的消息
        const regeneratingMessage = document.querySelector('.message.regenerating');
        if (regeneratingMessage) {
            console.log("移除regenerating类");
            regeneratingMessage.classList.remove('regenerating');
        }
        
        console.log("设置window.isGenerating为false");
        window.isGenerating = false;
    }
}

// 初始化滚动监听
document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.getElementById('chat-messages');
    
    // 监听滚动事件
    chatMessages.addEventListener('scroll', function() {
        clearTimeout(scrollTimeout);
        
        // 检测用户是否主动滚动（向上滚动或非自动滚动导致的变化）
        const currentScrollTop = chatMessages.scrollTop;
        if (currentScrollTop < lastScrollTop) {
            userScrolling = true;
        }
        
        lastScrollTop = currentScrollTop;
        
        // 设置一个滚动停止检测定时器
        scrollTimeout = setTimeout(function() {
            // 如果滚动到接近底部，重置用户滚动状态
            const scrollPosition = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;
            if (scrollPosition < 50) {
                userScrolling = false;
            }
        }, 100); //警告：不要修改成100ms，而是100，因为参数不支持100后面紧邻单位
    });
});

// 改进的shouldAutoScroll函数
window.shouldAutoScroll = function(container) {
    // 检查是否已经滚动到接近底部（距离底部50px以内）
    const scrollPosition = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = scrollPosition < 50; // 增加阈值从30px到50px，让自动滚动更容易触发
    
    // 正在生成内容且用户未主动滚动上方，或已经在底部附近，则允许自动滚动
    if ((window.isGenerating && !userScrolling) || isNearBottom) {
        return true;
    }
    
    return false;
};

// 重置用户滚动状态的函数
window.resetScrollState = function() {
    userScrolling = false;
    const chatMessages = document.getElementById('chat-messages');
    // 使用平滑滚动效果
    chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: 'smooth'
    });
};

// 强制滚动到底部的函数
window.scrollToBottom = function(smooth = true) {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
    });
};

// 向后兼容的函数引用
function shouldAutoScroll(container) {
    return window.shouldAutoScroll(container);
}


// 在文件开头定义函数
function createVersionControl(messageIndex, messageActions, message) {
    const versionControl = document.createElement('div');
    versionControl.className = 'version-control';

    const prevButton = document.createElement('button');
    prevButton.className = 'version-btn';
    prevButton.textContent = '←';
    prevButton.disabled = message.currentVersion === 0;
    prevButton.onclick = (e) => {
        e.preventDefault();
        if (window.isGenerating || currentReader) {
            showToast('正在生成内容，无法切换版本');
            return;
        }
        if (message.currentVersion > 0) {
            // 禁用按钮，防止重复点击
            prevButton.disabled = true;
            nextButton.disabled = true;
            switchVersion(messageIndex, message.currentVersion - 1)
                .finally(() => {
                    // 操作完成后，按钮状态会在createVersionControl中重新设置
                });
        }
    };

    const nextButton = document.createElement('button');
    nextButton.className = 'version-btn';
    nextButton.textContent = '→';
    nextButton.disabled = message.currentVersion === message.versions.length - 1;
    nextButton.onclick = (e) => {
        e.preventDefault();
        if (window.isGenerating || currentReader) {
            showToast('正在生成内容，无法切换版本');
            return;
        }
        if (message.currentVersion < message.versions.length - 1) {
            // 禁用按钮，防止重复点击
            prevButton.disabled = true;
            nextButton.disabled = true;
            switchVersion(messageIndex, message.currentVersion + 1)
                .finally(() => {
                    // 操作完成后，按钮状态会在createVersionControl中重新设置
                });
        }
    };

    const versionText = document.createElement('span');
    versionText.className = 'version-text';
    versionText.textContent = `版本 ${message.currentVersion + 1}/${message.versions.length}`;

    versionControl.appendChild(prevButton);
    versionControl.appendChild(versionText);
    versionControl.appendChild(nextButton);

    // 控制版本控制区域显示状态的函数
    const updateVisibility = () => {
        const isGenerating = window.isGenerating || currentReader || sendButton.classList.contains('stop');
        if (isGenerating) {
            versionControl.style.display = 'none';
        } else {
            versionControl.style.display = 'block';
            // 更新按钮状态
            prevButton.disabled = message.currentVersion === 0;
            nextButton.disabled = message.currentVersion === message.versions.length - 1;
        }
    };

    // 初始状态设置
    updateVisibility();

    // 定期检查状态
    const visibilityInterval = setInterval(() => {
        updateVisibility();
        if (!versionControl.isConnected) {
            clearInterval(visibilityInterval);
        }
    }, 100);

    messageActions.appendChild(versionControl);
}

function createRegenerateButton(messageIndex, messageActions, isError = false) {
    const regenerateBtn = document.createElement('button');
    regenerateBtn.className = 'regenerate-btn';
    regenerateBtn.innerHTML = '🔄 重新生成';
    
    // 控制重新生成按钮显示状态的函数
    const updateVisibility = () => {
        const isGenerating = window.isGenerating || currentReader || sendButton.classList.contains('stop');
        if (isGenerating) {
            regenerateBtn.style.display = 'none';
        } else {
            regenerateBtn.style.display = 'block';
        }
    };
    
    // 初始状态设置
    updateVisibility();
    
    // 定期检查状态
    const visibilityInterval = setInterval(() => {
        updateVisibility();
        if (!regenerateBtn.isConnected) {
            clearInterval(visibilityInterval);
        }
    }, 100);
    
    regenerateBtn.onclick = () => {
        const messageDiv = document.querySelector(`[data-message-index="${messageIndex}"]`);
        if (!messageDiv) return;
        
        const messageContent = messageDiv.querySelector('.message-content');
        if (!messageContent) return;
        
        // 禁用按钮，防止重复点击
        regenerateBtn.disabled = true;
        
        // 清空现有内容
        messageContent.innerHTML = '';
        
        // 移除错误状态
        messageDiv.classList.remove('error-message');
        
        // 添加regenerating标记
        messageDiv.classList.add('regenerating');
        
        // 不再需要手动隐藏按钮，由updateVisibility处理
        // regenerateBtn.style.display = 'none';
        
        // 如果是错误消息，获取实际需要使用的消息索引
        let targetIndex = messageIndex;
        if (isError) {
            // 针对错误消息，我们需要确保使用正确的索引
            // 如果是在 switchConversation 中自动添加的错误消息，
            // 直接使用当前传入的 messageIndex，因为我们已经确保它是正确的值
            const currentConversation = conversations.find(c => c.id === currentConversationId);
            if (currentConversation && messageIndex >= currentConversation.messages.length) {
                // 这是一个自动添加的错误消息，保持索引不变
                targetIndex = messageIndex;
            }
        }
        
        // 根据是否是错误消息，决定调用哪个函数
        (isError ? regenerateErrorMessage(targetIndex) : regenerateMessage(targetIndex))
            .catch(err => {
                console.error('重新生成消息失败:', err);
                // 恢复按钮状态
                regenerateBtn.disabled = false;
                // 不再需要手动显示按钮，由updateVisibility处理
                // regenerateBtn.style.display = 'block';
                messageDiv.classList.remove('regenerating');
                messageDiv.classList.add('error-message');
                messageContent.innerHTML = `<p>重新生成失败: ${err.message}</p>`;
            });
    };
    
    messageActions.appendChild(regenerateBtn);
}

// 从思考内容提取摘要，如果有
function extractSummaryFromThinking(reasoningData) {
    if (reasoningData.reasoning_summary) {
        return reasoningData.reasoning_summary;
    }
    
    // 如果没有摘要但有思考内容，截取开头的一部分作为摘要
    if (reasoningData.reasoning_content) {
        const content = reasoningData.reasoning_content;
        // 如果内容太长，截取前200个字符作为摘要
        if (content.length > 200) {
            return content.substring(0, 200) + '...';
        }
        return content;
    }
    
    return null;
}

// 修改后的 appendMessage 函数
function appendMessage(content, isUser = false, messageIndex = null, attachments = [], modelInfo = null, error = false) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = isUser ? 'message user-message' : 'message assistant-message';
    
    if (error) {
        messageDiv.classList.add('error-message');
    }
    
    if (messageIndex !== null) {
        messageDiv.setAttribute('data-message-index', messageIndex);
    }
    
    // 添加用户或模型图标
    const iconWrapper = document.createElement('div');
    iconWrapper.className = isUser ? 'user-icon-wrapper' : 'model-icon-wrapper';
    
    let modelIconElement;
    // 用户消息图标
    if (isUser) {
        const userIcon = document.createElement('div');
        userIcon.className = 'user-icon';
        // 创建用户图标内容
        iconWrapper.appendChild(userIcon);
    } 
    // 助手消息图标
    else {
        // 使用图标渲染器处理模型图标
        let modelIconValue = '';
        
        if (modelInfo) {
            if (typeof modelInfo === 'string') {
                modelIconValue = modelInfo;
            } else if (modelInfo.icon) {
                modelIconValue = modelInfo.icon;
            }
        }
        
        // 尝试从消息中获取模型图标
        if (!modelIconValue && messageIndex !== null && conversations.length > 0) {
            const currentConversation = conversations.find(c => c.id === currentConversationId);
            if (currentConversation && currentConversation.messages[messageIndex]) {
                const message = currentConversation.messages[messageIndex];
                if (message.modelIcon) {
                    modelIconValue = message.modelIcon;
                }
            }
        }
        
        // 如果没有模型图标，使用默认图标
        if (!modelIconValue) {
            modelIconValue = 'aperture';
        }
        
        // 设置数据属性
        iconWrapper.setAttribute('data-model-icon', modelIconValue);
        
        // 渲染图标
        const iconRenderer = new IconRenderer(modelIconValue);
        modelIconElement = iconRenderer.modelIcon;
        iconWrapper.appendChild(modelIconElement);
    }
    
    messageDiv.appendChild(iconWrapper);
    
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const md = initMarkdownit();
    
    // 处理附件
    if (attachments && attachments.length > 0) {
        const attachmentsContainer = document.createElement('div');
        attachmentsContainer.className = 'attachments-container';
        
        // 遍历附件
        attachments.forEach(attachment => {
            if (attachment && attachment.type && AttachmentTypeLoader.isRegistered(attachment.type)) {
                const handler = AttachmentTypeLoader.getHandler(attachment.type);
                if (handler) {
                    const element = handler.createPreviewElement(attachment);
                    if (element) {
                        attachmentsContainer.appendChild(element);
                    }
                }
            }
        });
        
        messageContent.appendChild(attachmentsContainer);
    }
    
    // 处理普通文本内容
    if (content) {
        const textContentDiv = document.createElement('div');
        textContentDiv.className = 'text-content';
        textContentDiv.innerHTML = md.render(content);
        
        // 初始化代码块
        initializeCodeBlocks(textContentDiv);
        
        messageContent.appendChild(textContentDiv);
    }
    
    // 恢复思考框
    if (!isUser && messageIndex !== null && conversations.length > 0) {
        const currentConversation = conversations.find(c => c.id === currentConversationId);
        if (currentConversation && currentConversation.messages[messageIndex]) {
            const message = currentConversation.messages[messageIndex];
            
            // 获取消息版本（如果有），否则使用消息本身
            const messageData = message.versions && message.versions[message.currentVersion || 0] ? 
                message.versions[message.currentVersion || 0] : 
                message;
            
            // 恢复思考框
            if (messageData.reasoning_content) {
                const reasoningBox = new ReasoningBox(messageContent, md);
                reasoningBox.setContent(messageData.reasoning_content);
                reasoningBox.markGenerationComplete();
                
                // 设置思考时间（如果有）
                if (messageData.thinking_time) {
                    reasoningBox.setThinkingTime(messageData.thinking_time);
                }
            }
            
            // 恢复工具框
            if (messageData.tool_boxes && Array.isArray(messageData.tool_boxes)) {
                for (const toolBoxData of messageData.tool_boxes) {
                    if (toolBoxData) {
                        try {
                            // 使用工具框的静态方法创建工具框
                            ToolBox.createFromSerializedData(messageContent, md, toolBoxData);
                        } catch (e) {
                            console.error('恢复工具框失败:', e);
                        }
                    }
                }
            }
        }
    }
    
    // 添加消息操作区域
    const messageActions = document.createElement('div');
    messageActions.className = 'message-actions';
    
    messageWrapper.appendChild(messageContent);
    messageWrapper.appendChild(messageActions);
    messageDiv.appendChild(messageWrapper);
    
    // 如果是消息数组中的指定消息，添加相应的操作按钮
    if (messageIndex !== null) {
        const currentConversation = conversations.find(c => c.id === currentConversationId);
        if (currentConversation && currentConversation.messages) {
            if (isUser && messageIndex < currentConversation.messages.length) {
                // 确保messageActions是空的，防止重复创建按钮
                messageActions.innerHTML = '';
                createEditButton(messageIndex, messageActions);
            } else if (!isUser && messageIndex < currentConversation.messages.length) {
                // 确保messageActions是空的，防止重复创建按钮
                messageActions.innerHTML = '';
                createRegenerateButton(messageIndex, messageActions);
                
                // 获取当前消息
                const message = currentConversation.messages[messageIndex];
                
                // 如果消息有版本，添加版本控制
                if (message && message.versions && message.versions.length > 1) {
                    createVersionControl(messageIndex, messageActions, message);
                }
            }
        }
    }
    
    chatMessages.appendChild(messageDiv);
    return messageDiv;
}

// 在文件开头添加这个变量
const default_system_prompt = String.raw`你是一个AI助理。你需要尽可能地满足用户的需求。在页面格式方面有以下提示：请直接输出markdown内容，不要添加额外的代码块标记。如果需要显示代码，直接使用markdown的代码块语法。

对于数学公式，请严格遵循以下格式规范（特别重要）：

1. 行内公式：使用单个 $ 符号包裹，例如：$E=mc^2$

2. 独立公式：使用双 $$ 符号包裹，例如：
   $$
   \int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
   $$

3. 带编号的公式：使用 equation 环境（注意必须加反斜杠），例如：
   $$
   \begin{equation}
   F = ma
   \end{equation}
   $$

4. 多行对齐公式：使用 align 环境（注意必须加反斜杠），例如：
   $$
   \begin{align}
   x &= a + b \\
   y &= c + d
   \end{align}
   $$

5. 矩阵：使用 matrix、pmatrix、bmatrix 等环境（注意必须加反斜杠），例如：
   $$
   \begin{pmatrix}
   a & b \\
   c & d
   \end{pmatrix}
   $$

6. 分段函数：使用 cases 环境（注意必须加反斜杠），例如：
   $$
   \begin{cases}
   x + y = 1 \\
   x - y = 2
   \end{cases}
   $$

7. 多环境公式嵌套与流程图的正确表示方法：
   $$
   \begin{align}
   \text{流程步骤1} &\rightarrow \text{流程步骤2} \rightarrow \text{流程步骤3} \\
   &\rightarrow \text{流程步骤4} \rightarrow \text{流程步骤5}
   \end{align}
   $$

8. 单独公式块的正确隔离：每个不同类型的公式应使用独立的公式块，例如：
   $$
   \begin{align}
   \text{第一组公式} &\rightarrow \text{内容} \\
   &\rightarrow \text{更多内容}
   \end{align}
   $$
   $$
   \begin{equation}
   \text{第二组公式} = \boxed{\text{内容}}
   \end{equation}
   $$

特别注意事项（必须严格遵守）：
1. 所有LaTeX环境和命令必须以反斜杠(\)开头，例如：
   - 正确：\begin{equation}
   - 错误：begin{equation}
   - 正确：\frac{a}{b}
   - 错误：frac{a}{b}

2. 所有中文文本必须用 \text{} 包裹，例如：
   $$
   \text{速度} = \frac{\text{位移}}{\text{时间}}
   $$

3. 换行必须使用 \\ 而不是单个反斜杠

4. 不要使用任何特殊颜色标记或HTML格式标记

5. 分数必须使用 \frac 而不是其他简写形式

6. 环境标签必须匹配：\begin{环境名} 必须对应 \end{环境名}
   - 正确：\begin{align} ... \end{align}
   - 错误：\begin{align} ... \end{equation}

7. 不同的公式块必须分开写，不要混合不同类型的公式在同一个公式块中

支持的数学符号和命令：
- 上标：^
- 下标：_
- 分数：\frac{分子}{分母} 
- 求和：\sum_{下限}^{上限}
- 积分：\int_{下限}^{上限}
- 希腊字母：\alpha, \beta, \gamma, \pi 等
- 数学函数：\sin, \cos, \tan, \log, \lim 等
- 特殊符号：\infty, \partial, \nabla 等
- 矢量：\vec{x} 或 \boldsymbol{x}
- 数学字体：\mathbb{R}, \mathcal{L} 等

错误示范（这些都是不正确的写法）：
- egin{cases} ❌  应该是 \begin{cases}
- rac{a}{b} ❌  应该是 \frac{a}{b}
- 直接写中文文本 ❌  应该用 \text{中文文本}
- 使用单个\ ❌  应该用 \\
- \begin{align} ... \end{equation} ❌  应该用 \begin{align} ... \end{align}
- 在同一个公式块中混合多种不相关公式 ❌  应该分成多个公式块

请确保公式格式正确，并在适当的场景使用合适的公式环境。每个公式都必须经过仔细检查，确保所有命令都有正确的反斜杠前缀，并且环境标签正确匹配。`;

// 修改保存函数，改为只保存单个对话
export async function saveConversation(conversationId, operation = 'update') {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;
    console.log("start saving conversation");

    // 获取当前的模型设置
    const modelSettings = window.modelSettingRenderer.getSettings();
    const selectedModel = document.getElementById('model-select').value;
    const maxTokens = modelSettings.current_output_tokens;  // 使用 current_output_tokens

    // 更新对话中的设置
    conversation.temperature = modelSettings.temperature;
    conversation.max_tokens = maxTokens;  // 保存 current_output_tokens
    conversation.model_id = selectedModel;  // 保存当前选中的模型
    conversation.reasoning_effort = modelSettings.reasoning_effort; // 保存思考力度设置

    try {
        console.log('Saving conversation with settings:', {
            temperature: modelSettings.temperature,
            max_tokens: maxTokens,
            model_id: selectedModel,
            reasoning_effort: modelSettings.reasoning_effort
        });
        
        const response = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                conversation: conversation,
                operation: operation,
                temperature: modelSettings.temperature,
                max_tokens: maxTokens,
                model_id: selectedModel,
                reasoning_effort: modelSettings.reasoning_effort
            })
        });
        
        if (!response.ok) {
            throw new Error('保存失败');
        }
        // 只在特定操作时显示提示
        if (operation === 'create') {
            showToast('新对话已创建');
        } else if (operation === 'delete') {
            showToast('对话已删除');
        }
        // 普通的更新操作就不显示提示了，避免打扰用户

    } catch (error) {
        console.error('保存对话失败:', error);
        showToast(`保存失败: ${error.message}`, 'error');
    }
}

// 修改创建新对话函数
async function createNewConversation() {
    if (currentReader) {
        stopGeneration();
    }

    clearAttachmentPreview();

    if (currentConversationId) {
        const currentConversation = conversations.find(c => c.id === currentConversationId);
        if (currentConversation && currentConversation.messages.length === 0) {
            return currentConversation;
        }
    }
    
    const conversation = {
        id: Date.now().toString(),
        title: '新对话',
        messages: [],
        systemPrompt: default_system_prompt
    };
    
    // 获取当前的模型设置
    if (window.modelSettingRenderer) {
        const modelSettings = window.modelSettingRenderer.getSettings();
        conversation.temperature = modelSettings.temperature;
        conversation.max_tokens = modelSettings.current_output_tokens;
        conversation.reasoning_effort = modelSettings.reasoning_effort; // 添加思考力度设置
    }
    
    conversations.unshift(conversation);
    currentConversationId = conversation.id;
    
    chatMessages.innerHTML = '';
    messages = [
        {"role": "system", "content": default_system_prompt}
    ];
    
    const systemPromptTextarea = document.getElementById('system-prompt');
    systemPromptTextarea.value = default_system_prompt;
    
    renderConversationsList();
    
    // 创建新对话时立即保存
    await saveConversation(conversation.id, 'create');
    
    return conversation;
}

// 修改删除对话函数
async function deleteConversation(conversationId) {
    if (window.isGenerating || currentReader) {
        showToast('请先停止当前生成再删除对话', 'error');
        return;
    }
    if (!confirm('确定要删除这个对话吗？')) {
        return;
    }
    
    const index = conversations.findIndex(c => c.id === conversationId);
    if (index !== -1) {
        // 先删除服务器端数据
        try {
            await saveConversation(conversationId, 'delete');
            
            // 删除成功后更新本地状态
            conversations.splice(index, 1);
            
            if (conversationId === currentConversationId) {
                if (conversations.length > 0) {
                    currentConversationId = conversations[0].id;
                    await switchConversation(currentConversationId);
                } else {
                    await createNewConversation();
                }
            }
            renderConversationsList();
            
        } catch (error) {
            console.error('删除对话失败:', error);
            showToast('删除对话失败', 'error');
        }
    }
}

// 修改加载对话函数
async function loadConversations() {
    try {
        const response = await fetch('/api/conversations');
        if (!response.ok) {
            throw new Error('加载对话失败');
        }
        const data = await response.json();
        conversations = data.conversations || [];
        
        // 修复数据结构：确保每个消息和版本都有正确的字段
        conversations.forEach(conversation => {
            if (conversation.messages) {
                // 遍历所有消息
                conversation.messages.forEach((message, index) => {
                    // 如果是助手消息，则确保currentVersion存在
                    if (message.role === 'assistant' && message.versions && message.versions.length > 0) {
                        // 确保currentVersion是有效的
                        if (message.currentVersion === undefined || message.currentVersion < 0 || 
                            message.currentVersion >= message.versions.length) {
                            message.currentVersion = message.versions.length - 1;
                            console.log(`修正 ${index} 号消息的版本索引为`, message.currentVersion);
                        }
                        
                        // 确保每个版本都有必要的字段
                        message.versions.forEach((version, versionIndex) => {
                            // 确保版本有内容字段
                            if (!version.content && message.content) {
                                version.content = message.content;
                            }
                            
                            // 确保版本有模型信息
                            if (!version.modelId && message.modelId) {
                                version.modelId = message.modelId;
                            }
                            if (!version.modelIcon && message.modelIcon) {
                                version.modelIcon = message.modelIcon;
                            }
                            
                            // 确保每个版本都有subsequentMessages字段
                            if (!version.subsequentMessages) {
                                version.subsequentMessages = [];
                                
                                // 如果是当前版本，保存之后的消息作为后续消息
                                if (versionIndex === message.currentVersion) {
                                    version.subsequentMessages = conversation.messages.slice(index + 1);
                                }
                            }
                        });
                        
                        // 使用当前版本的内容更新消息内容，确保UI显示正确版本
                        const currentVersion = message.versions[message.currentVersion];
                        if (currentVersion && currentVersion.content) {
                            message.content = currentVersion.content;
                        }
                    }
                });
            }
        });
        
        if (currentConversationId) {
            const currentConversation = conversations.find(c => c.id === currentConversationId);
            if (currentConversation) {
                const systemPromptTextarea = document.getElementById('system-prompt');
                systemPromptTextarea.value = currentConversation.systemPrompt || default_system_prompt;
                
                // 更新模型设置
                if (window.modelSettingRenderer) {
                    // 获取当前选中的模型配置
                    const modelSelect = document.getElementById('model-select');
                    
                    // 获取最后一条助手消息的模型信息
                    const lastModel = getLastAssistantModel({messages: currentConversation.messages});
                    console.log('当前会话最后使用的模型:', lastModel);
                    
                    // 如果有最后使用的模型，则使用该模型
                    if (lastModel && lastModel.modelId) {
                        updateModelSelect(lastModel.modelId, modelSelect);
                        
                        // 确保图标更新
                        const titleIconRenderer = document.querySelector('#model-icon');
                        if (titleIconRenderer) {
                            // 从icon_types.js导入的映射中获取图标路径
                            const iconPath = model_to_svg[lastModel.modelIcon];
                            if (iconPath) {
                                console.log('直接更新标题图标为:', lastModel.modelIcon);
                                titleIconRenderer.src = iconPath;
                            }
                        }
                    } else if (currentConversation.model_id) {
                        updateModelSelect(currentConversation.model_id, modelSelect);
                    }
                    
                    const selectedOption = modelSelect.selectedOptions[0];
                    const maxTokens = parseInt(selectedOption.getAttribute('data-max-output-tokens')) || 4096;
                    const defaultTokens = parseInt(selectedOption.getAttribute('data-default-output-tokens')) || Math.floor(maxTokens/2);

                    // 使用保存的设置，如果没有则使用默认值
                    const settings = {
                        max_output_tokens: maxTokens,
                        default_output_tokens: defaultTokens,
                        default_temperature: 0.7,
                        maxTokens: currentConversation.max_tokens || defaultTokens,
                        temperature: currentConversation.temperature || 0.7
                    };
                    
                    window.modelSettingRenderer.setSettings(settings);
                }
            }
        }
        
        renderConversationsList();
    } catch (error) {
        console.error('加载对话出错:', error);
        conversations = [];
        renderConversationsList();
    }
}

// 渲染对话列表
function renderConversationsList() {
    const conversationsList = document.querySelector('.conversations-list');
    conversationsList.innerHTML = '';
    
    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = `conversation-item ${conv.id === currentConversationId ? 'active' : ''}`;
        item.setAttribute('data-id', conv.id);
        
        // 创建标题容器
        const titleContainer = document.createElement('div');
        titleContainer.className = 'conversation-title-container';
        
        // 创建标题元素
        const title = document.createElement('div');
        title.className = 'conversation-title';
        title.textContent = conv.title;
        title.onclick = () => switchConversation(conv.id);
        
        // 创建编辑按钮
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-title-btn';
        editBtn.innerHTML = '✏️';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            editConversationTitle(conv.id);
        };
        
        // 创建删除按钮
        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'delete-conversation';
        deleteBtn.textContent = '×';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteConversation(conv.id);
        };
        
        titleContainer.appendChild(title);
        titleContainer.appendChild(editBtn);
        item.appendChild(titleContainer);
        item.appendChild(deleteBtn);
        conversationsList.appendChild(item);
    });
}

// 修改 switchConversation 函数
async function switchConversation(conversationId) {
    if (currentReader || window.isGenerating) {
        showToast('请先停止当前生成再切换对话', 'error');
        return;
    }
    
    clearAttachmentPreview();
    
    currentConversationId = conversationId;
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;
    
    // 更新系统提示词
    const systemPromptTextarea = document.getElementById('system-prompt');
    systemPromptTextarea.value = conversation.systemPrompt || default_system_prompt;
    
    // 确保每条消息都使用当前选择的版本内容
    if (conversation.messages) {
        conversation.messages.forEach((message, index) => {
            if (message.role === 'assistant' && message.versions && message.versions.length > 0) {
                // 确保currentVersion有效
                if (message.currentVersion === undefined || message.currentVersion < 0 || 
                    message.currentVersion >= message.versions.length) {
                    message.currentVersion = message.versions.length - 1;
                }

                // 使用当前版本的内容更新消息内容
                const currentVersion = message.versions[message.currentVersion];
                if (currentVersion && currentVersion.content) {
                    message.content = currentVersion.content;
                }
            }
        });
    }
    
    // 更新模型设置
    if (window.modelSettingRenderer) {
        // 获取当前选中的模型配置
        const modelSelect = document.getElementById('model-select');
        
        // 获取最后一条助手消息的模型信息
        const lastModel = getLastAssistantModel({messages: conversation.messages});
        console.log('lastModel:', lastModel);
        
        // 如果有最后使用的模型，则使用该模型
        // 否则使用对话中保存的模型ID
        // 如果都没有，保持当前选择
        if (lastModel && lastModel.modelId) {
            updateModelSelect(lastModel.modelId, modelSelect);
        } else if (conversation.model_id) {
            updateModelSelect(conversation.model_id, modelSelect);
        }
        
        const selectedOption = modelSelect.selectedOptions[0];
        const maxTokens = parseInt(selectedOption.getAttribute('data-max-output-tokens'));
        if (!maxTokens) {
            console.error('无法获取模型的 max_output_tokens');
            return;
        }

        // 获取保存的值或使用默认值
        let savedMaxTokens = conversation.max_tokens;
        // 如果保存的值超过了当前模型的最大值，则使用最大值
        if (savedMaxTokens > maxTokens) {
            savedMaxTokens = maxTokens;
            // 更新数据库中的值
            conversation.max_tokens = maxTokens;
            saveConversation(conversation.id, 'update');
        }

        console.log('Switching conversation with settings:', {
            maxTokens,
            savedMaxTokens,
            savedTemperature: conversation.temperature
        });

        // 使用保存的设置，如果没有则使用默认值
        const settings = {
            max_output_tokens: maxTokens,
            default_output_tokens: Math.floor(maxTokens / 2),
            default_temperature: 0.7,
            current_output_tokens: savedMaxTokens || Math.floor(maxTokens / 2),
            temperature: conversation.temperature || 0.7,
            reasoning_effort: conversation.reasoning_effort || 'high'  // 添加思考力度设置，默认为high
        };
        
        console.log('Applying settings:', settings);
        window.modelSettingRenderer.setSettings(settings);
        
        // 检查当前模型是否支持思考力度调整
        const currentModelId = modelSelect.value;
        window.modelSettingRenderer.checkReasoningEffortSupport(currentModelId);
    }
    
    clearChatMessages();
    messages = [
        {"role": "system", "content": conversation.systemPrompt || default_system_prompt},
        ...conversation.messages
    ];

    // 渲染消息 - 过滤掉type为'function'的消息，这些消息不应该独立显示
    conversation.messages.forEach((msg, index) => {
        // 跳过工具消息，根据type字段判断(标准格式)，或role字段判断(兼容旧格式)
        // 但保留带有step和result内容的工具消息，这些需要显示在UI中
        if ((msg.type === 'function' || msg.role === 'tool') && 
            !msg.display_text && !msg.result && !msg.function) {
            console.log(`跳过工具消息: ${index}`, msg);
            return;
        }
        
        if (msg.role === 'assistant' && msg.versions && msg.versions[msg.currentVersion]) {
            const currentVersion = msg.versions[msg.currentVersion];
            appendMessage(msg.content, false, index, msg.attachments, currentVersion.modelIcon);
        } else if (msg.role === 'tool' || msg.type === 'function') {
            // 处理工具消息的渲染
            console.log(`渲染工具消息: ${index}`, msg);
            // 工具消息不直接渲染，而是通过assistant消息的工具框来显示
            // 这里不做额外处理，由assistant消息的工具框处理
        } else {
            appendMessage(msg.content, msg.role === 'user', index, msg.attachments);
        }
    });
    
    // 检查最后一条消息是否为用户消息，如果是，则添加一个错误消息占位符并提供重新生成按钮
    if (conversation.messages.length > 0) {
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        if (lastMessage.role === 'user') {
            // 创建一个错误消息占位符
            const chatMessages = document.getElementById('chat-messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant-message error-message';
            // 将索引设置为实际消息数量，而不是最后一条消息的索引
            // 这样可以确保新生成的消息添加在用户消息之后，而不是覆盖用户消息
            messageDiv.setAttribute('data-message-index', conversation.messages.length);
            
            // 添加模型图标元素
            const modelSelect = document.getElementById('model-select');
            const selectedOption = modelSelect.selectedOptions[0];
            const modelIcon = selectedOption.getAttribute('data-model-icon');
            const iconRenderer = new IconRenderer(modelIcon);
            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'model-icon-wrapper';
            iconWrapper.setAttribute('data-model-icon', modelIcon);
            iconWrapper.appendChild(iconRenderer.modelIcon);
            messageDiv.appendChild(iconWrapper);
            
            // 创建消息包装器
            const messageWrapper = document.createElement('div');
            messageWrapper.className = 'message-wrapper';
            
            // 创建消息内容
            const messageContent = document.createElement('div');
            messageContent.className = 'message-content';
            
            // 创建文本内容
            const textContent = document.createElement('div');
            textContent.className = 'text-content';
            textContent.innerHTML = '<p>上次响应可能未完成或发生错误，点击重新生成按钮重新生成回复</p>';
            messageContent.appendChild(textContent);
            
            // 创建操作按钮区域
            const messageActions = document.createElement('div');
            messageActions.className = 'message-actions';
            messageActions.style.display = 'flex';
            messageActions.style.justifyContent = 'center';
            
            // 创建重新生成按钮 - 确保使用正确的 messageIndex 参数
            // 传递当前消息数量而不是用户消息的索引，确保新回复不会覆盖用户消息
            createRegenerateButton(conversation.messages.length, messageActions, true);
            
            // 组装DOM结构
            messageWrapper.appendChild(messageContent);
            messageWrapper.appendChild(messageActions);
            messageDiv.appendChild(messageWrapper);
            chatMessages.appendChild(messageDiv);
        }
    }
    
    // 重新应用代码高亮，确保所有代码块正确渲染
    document.querySelectorAll('.text-content').forEach(textContent => {
        // 重新应用代码高亮，但是只对包含code-block-wrapper的容器
        initializeCodeBlocks(textContent);
    });

    //平滑的滚动到最底部
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: 'smooth'
    });

    renderConversationsList();
}

// 清空聊天消息
function clearChatMessages() {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';
    // 重置 messages 数组，但保留系统提示
    messages = [
        {"role": "system", "content": default_system_prompt}
    ];
}


// 初始化附件渲染器
const attachmentRenderer = new AttachmentRenderer();
attachmentRenderer.setContainer(document.getElementById('attachment-preview'));

// 初始化文件选择器
// const fileSelector = new FileSelector({
//     multiple: true,
//     accept: '*/*',  // 预留接口，支持所有文件
//     onFileSelected: async (file) => {
//         try {
//             console.log('开始处理选中的文件:', file);  // 调试日志
//             const imageAttachment = await ImageAttachment.fromFile(file);
//             console.log('创建的 ImageAttachment:', imageAttachment);  // 调试日志
            
//             if (imageAttachment) {
//                 // await imageAttachment.compress();
//                 // console.log('压缩后的 ImageAttachment:', imageAttachment);  // 调试日志
                
//                 // 直接将 imageAttachment 添加到 imageUploader
//                 imageUploader.attachments.add(imageAttachment);
//                 console.log('当前 imageUploader 中的附件:', imageUploader.getAttachments());  // 调试日志
                
//                 const previewContainer = document.getElementById('attachment-preview');
//                 if (!previewContainer) {
//                     console.error('预览容器未找到');
//                     return;
//                 }
                
//                 // 使用 imageAttachment 创建预览元素
//                 const previewElement = imageAttachment.createUploadPreviewElement(() => {
//                     imageUploader.attachments.delete(imageAttachment);
//                     previewContainer.removeChild(previewElement);
//                 });
                
//                 if (previewElement) {
//                     previewContainer.appendChild(previewElement);
//                     console.log('预览元素已添加到容器');  // 调试日志
//                 }
//             }
//         } catch (error) {
//             console.error('处理图片失败:', error);
//             showError('处理图片失败，请重试');
//         }
//     }
// });

// 修改上传按钮的点击事件
const uploadButton = document.getElementById('upload-button');
const uploader = new Uploader({
    container: document.getElementById('attachment-preview'),
    onDelete: (attachment) => {
        console.log('删除附件:', attachment);
        // 从预览容器中移除预览元素
        if (attachment.previewElement && attachment.previewElement.parentNode) {
            attachment.previewElement.parentNode.removeChild(attachment.previewElement);
        }
        // 从 imageUploader 中也删除附件
        imageUploader.attachments.delete(attachment);
        
        // 检查是否还有附件，如果没有则隐藏容器
        // 使用uploader.getAttachments()来判断是否还有附件
        if (uploader.getAttachments().length === 0) {
            const previewContainer = document.getElementById('attachment-preview');
            if (previewContainer) {
                console.log('没有附件了，隐藏预览容器');
                previewContainer.style.display = 'none';
            }
        } else {
            console.log('还有其他附件，保持预览容器可见');
        }
    },
    onUploadSuccess: (attachment) => {
        console.log('文件上传成功，添加到 imageUploader:', attachment);
        // 将上传的附件添加到 imageUploader 中
        imageUploader.attachments.add(attachment);
        
        // 确保预览容器可见
        const previewContainer = document.getElementById('attachment-preview');
        if (previewContainer) {
            previewContainer.style.display = 'flex';
        }
    },
    previewHandler: async (previewElement) => {
        // 使用 AttachmentRenderer 处理预览元素
        if (previewElement && previewElement instanceof HTMLElement) {
            attachmentRenderer.addExternalElement(previewElement);
            return true; // 返回true表示已处理
        }
        return false; // 返回false表示未处理
    }
});

uploadButton.addEventListener('click', () => {
    console.log('触发文件上传...');
    uploader.selectFiles();
});

// 修改附件相关函数
function hasAttachments() {
    return uploader.getAttachments().length > 0;
}

function clearAttachmentPreview() {
    uploader.clearAll();
    attachmentRenderer.clearAll();
}

// 修改现有的sendMessage函数
async function sendMessage(retryCount = 1, retryDelay = 1000) {
    window.generationStopped = false;
    if (!canSendMessage()) return;
    
    
    // 重置滚动状态，确保新消息可以自动滚动
    window.resetScrollState();
    
    // 设置状态为正在生成内容
    window.isGenerating = true;
    
    try {
        let error = false;
        const content = userInput.value.trim();
        const md = initMarkdownit(); // 确保md对象被正确初始化

        if (!content && !hasAttachments()) return;

        // 获取选中的模型ID和类型
        const modelSelect = document.getElementById('model-select');
        const selectedOption = modelSelect.options[modelSelect.selectedIndex];
        const modelIcon = selectedOption.getAttribute('data-model-icon');
        const modelSettings = window.modelSettingRenderer.getSettings();
        const temperature = modelSettings.temperature;
        const max_tokens = modelSettings.current_output_tokens;

        // 清空输入框并重置高度
        userInput.value = '';
        userInput.style.height = 'auto';
        userInput.disabled = true;
        sendButton.textContent = '停止';
        sendButton.classList.add('stop');
        sendButton.disabled = true; // 在获取流以前先暂时禁用按钮
        userInput.disabled = false;

        const selectedModel = modelSelect.value;
        if (!selectedModel) {
            alert('请选择一个模型');
            return;
        }

        // 确保有当前对话
        if (!currentConversationId) {
            await createNewConversation();
        }

        // 将当前对话移动到列表顶部
        const currentIndex = conversations.findIndex(c => c.id === currentConversationId);
        if (currentIndex > 0) {
            const [conversation] = conversations.splice(currentIndex, 1);
            conversations.unshift(conversation);
            renderConversationsList();
        }

        // 获取当前对话
        const currentConversation = conversations[0];
        
        // 准备用户消息和附件
        const attachments = uploader.collectAttachments();
        const userMessage = {
            role: "user",
            content: content,
            attachments: attachments
        };

        // 添加用户消息到存储和界面
        currentConversation.messages.push(userMessage);
        const userMessageIndex = currentConversation.messages.length - 1;
        appendMessage(content, true, userMessageIndex, attachments, error);
        
        // 更新 messages 数组
        messages = [
            {"role": "system", "content": currentConversation.systemPrompt || default_system_prompt},
            ...currentConversation.messages
        ];
        
        // 添加思考内容到消息中
        // 遍历当前对话中的所有消息
        // const messagesWithThinking = messages.map(msg => {
        //     // 只处理助手消息
        //     if (msg.role === 'assistant') {
        //         // 获取对应的对话对象
        //         const messageIndex = currentConversation.messages.findIndex(m => m.content === msg.content && m.role === 'assistant');
        //         if (messageIndex !== -1) {
        //             const message = currentConversation.messages[messageIndex];
        //             // 检查是否有思考内容
        //             const reasoningData = message.versions && message.versions[message.currentVersion] ? 
        //                 message.versions[message.currentVersion] : 
        //                 message;
                    
        //             if (reasoningData.reasoning_content) {
        //                 // 获取思考摘要
        //                 const summary = extractSummaryFromThinking(reasoningData);
        //                 if (summary) {
        //                     // 添加思考摘要，使用 <think></think> 标记包裹
        //                     return {
        //                         ...msg,
        //                         content: '<think>' + summary + '</think>\n' + msg.content
        //                     };
        //                 }
        //             }
        //         }
        //     }
        //     return msg;
        // });
        
        // 立即保存用户消息到数据库
        await saveConversation(currentConversation.id, 'update');

        // 清空输入框并更新按钮状态
        clearAttachmentPreview();
        
        // 如果是第一条消息，生成对话标题
        if (currentConversation.messages.length === 1) {
            currentConversation.title = content.slice(0, 20) + (content.length > 20 ? '...' : '');
            renderConversationsList();
            generateTitle(content);
        }

        // 发送消息后强制滚动到底部
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
        // 临时重置用户滚动状态，确保接下来的消息能够自动滚动
        userScrolling = false;

        let assistantMessage = '';
        let reasoningContent = '';  // 添加思考内容变量
        const messageIndex = currentConversation.messages.length;
        
        // 创建消息元素
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant-message';
        messageDiv.setAttribute('data-message-index', messageIndex);

        // 模型icon和模型信息
        const iconRenderer = new IconRenderer(modelIcon);
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'model-icon-wrapper';
        iconWrapper.setAttribute('data-model-icon', modelIcon);
        iconWrapper.appendChild(iconRenderer.modelIcon);
        messageDiv.appendChild(iconWrapper);
        
        const messageWrapper = document.createElement('div');
        messageWrapper.className = 'message-wrapper';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = '';
        
        const messageActions = document.createElement('div');
        messageActions.className = 'message-actions';
        
        messageWrapper.appendChild(messageContent);
        messageWrapper.appendChild(messageActions);
        messageDiv.appendChild(messageWrapper);
        chatMessages.appendChild(messageDiv);
        
        // 重试循环
        for (let attempt = 0; attempt < retryCount; attempt++) {
            try {
                // 准备请求数据
                const requestData = { 
                    messages: messages, // 使用包含思考内容的消息
                    conversation_id: currentConversationId,
                    model_id: selectedModel,
                    temperature: temperature,
                    max_tokens: max_tokens,
                    reasoning_effort: window.modelSettingRenderer.getSettings().reasoning_effort // 添加思考力度参数
                };

                // 处理请求的回调函数
                //messageStatus 0: 第一条消息，1: 非第一条消息，-1：消息结束
                const afterProcessCallback = async (result,messageStatus = 0) => {
                    const { assistantMessage, reasoningBox, toolBoxMap, toolResult, is_valid } = result;
                    
                    // 成功接收到内容，保存到消息历史
                    if (is_valid) {
                        if(messageStatus == 0){
                            const thinking_time = reasoningBox ? reasoningBox.getThinkingTime() : 0;
                            const reasoning_summary = reasoningBox ? reasoningBox.getSummary() : null;
                            
                            // 收集工具框数据
                            const toolBoxesData = [];
                            if (toolBoxMap && toolBoxMap.size > 0) {
                                toolBoxMap.forEach((toolBox, toolCallId) => {
                                    if (toolBox) {
                                        toolBoxesData.push(toolBox.serializeForStorage());
                                    }
                                });
                            }

                            // toolResult.forEach(tool =>{
                            //     currentConversation.messages.push(
                            //         tool
                            //     );
                            // });
                            
                            currentConversation.messages.push({ 
                                role: "assistant", 
                                content: assistantMessage,
                                reasoning_content: reasoningBox ? reasoningBox.getContent() : null,
                                reasoning_summary: reasoning_summary, // 保存摘要
                                thinking_time: thinking_time,  // 保存思考时间
                                tool_boxes: toolBoxesData,     // 保存工具框数据
                                modelIcon: modelIcon,
                                modelId: selectedModel,
                                versions: [{
                                    content: assistantMessage,
                                    reasoning_content: reasoningBox ? reasoningBox.getContent() : null,
                                    reasoning_summary: reasoning_summary, // 保存摘要到版本历史
                                    thinking_time: thinking_time,  // 保存思考时间到版本历史
                                    tool_boxes: toolBoxesData,     // 保存工具框数据到版本历史
                                    attachments: [],
                                    subsequentMessages: [],
                                    modelIcon: modelIcon,
                                    modelId: selectedModel
                                }],
                                currentVersion: 0,
                                isInterrupted: window.generationStopped,  // 根据generationStopped状态判断是否被中断
                                tool_results: toolResult || [] // 初始化tool_results为工具结果或空数组
                            });
                        }
                        else if(messageStatus == -1){
                            // 添加重新生成按钮和版本控制
                            const messageWrapper = messageDiv.querySelector('.message-wrapper');
                            const messageActions = messageWrapper.querySelector('.message-actions');
                            createRegenerateButton(messageIndex, messageActions, false);
                        }
                        else if(messageStatus == 1){
                            //处理中间消息
                            const thinking_time = reasoningBox ? reasoningBox.getThinkingTime() : 0;
                            const reasoning_summary = reasoningBox ? reasoningBox.getSummary() : null;
                            
                            // 收集工具框数据
                            const toolBoxesData = [];
                            if (toolBoxMap && toolBoxMap.size > 0) {
                                toolBoxMap.forEach((toolBox, toolCallId) => {
                                    if (toolBox) {
                                        toolBoxesData.push(toolBox.serializeForStorage());
                                    }
                                });
                            }

                            // toolResult.forEach(tool =>{
                            //     currentConversation.messages.push(
                            //         tool
                            //     );
                            // });
                            
                            // 检查tool_results是否存在，不存在则初始化为空数组
                            if (!currentConversation.messages.at(-1).tool_results) {
                                currentConversation.messages.at(-1).tool_results = [];
                            }
                            
                            currentConversation.messages.at(-1).tool_results = currentConversation.messages.at(-1).tool_results.concat(toolResult);
                            currentConversation.messages.at(-1).tool_boxes = toolBoxesData;
                            currentConversation.messages.at(-1).reasoning_summary = reasoning_summary;
                            currentConversation.messages.at(-1).thinking_time = thinking_time;
                            currentConversation.messages.at(-1).reasoning_content = reasoningBox ? reasoningBox.getContent() : null;
                            currentConversation.messages.at(-1).content = assistantMessage;
                            currentConversation.messages.at(-1).versions.at(-1).tool_boxes = toolBoxesData;
                            currentConversation.messages.at(-1).versions.at(-1).reasoning_content = reasoningBox ? reasoningBox.getContent() : null;
                            currentConversation.messages.at(-1).versions.at(-1).reasoning_summary = reasoning_summary;
                            currentConversation.messages.at(-1).versions.at(-1).thinking_time = thinking_time;
                            currentConversation.messages.at(-1).versions.at(-1).content = assistantMessage;
                            currentConversation.messages.at(-1).isInterrupted = window.generationStopped;
                        }
                        // // 更新全局messages数组中的最后一条助手消息
                        // if (messages.length > 0) {
                        //     // 查找最后一条助手消息
                        //     for (let i = messages.length - 1; i >= 0; i--) {
                        //         if (messages[i].role === 'assistant') {
                        //             // 更新消息内容
                        //             messages[i].content = assistantMessage;
                        //             break;
                        //         }
                        //     }
                        // }
                        //每次处理完消息后，保存一次对话
                        await saveConversation(currentConversation.id, 'update');
                    }
                };

                // 使用公共函数处理消息请求
                await handleMessageRequest(
                    requestData,
                    messageDiv,
                    messageContent,
                    {
                        messageIndex,
                        md,
                        chatMessages,
                        shouldScrollToBottom: true,
                        afterProcessCallback
                    }
                );
                
                // 如果成功完成了请求，就跳出重试循环
                break;
                
            } catch (error) {
                console.error('发送消息出错:', error);
                
                // 如果这是最后一次尝试，或者错误是手动取消，不再重试
                if (attempt === retryCount - 1 || error.name === 'AbortError' || error.name === 'CancelError') {
                    throw error;
                }
                
                // 否则等待一段时间后重试
                console.log(`将在 ${retryDelay}ms 后重试 (${attempt + 2}/${retryCount})...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                // 每次重试增加延迟时间
                retryDelay *= 2;
            }
        }

        // 最终清理
        if (currentReader) {
            try {
                await currentReader.cancel();
            } catch (e) {
                console.log('Error cancelling stream:', e);
            }
            currentReader = null;
        }
        
        userInput.focus();
    } finally {
        // 确保在所有情况下都将生成状态设为false
        window.isGenerating = false;
        userInput.disabled = false;
        console.log("发送按钮触发1");
        sendButton.textContent = '发送';
        sendButton.classList.remove('stop');
        if(!canSendMessage()){
            sendButton.disabled = true;
        }else{
            sendButton.disabled = false;
        }
    }
}

// 将拖拽相关的代码移到单独的函数中
function initializeDragAndDrop() {
    const dropZone = document.getElementById('message-input-container');
    const attachmentPreview = document.getElementById('attachment-preview');
    
    if (!dropZone || !attachmentPreview) {
        console.warn('拖拽区域或预览区域未找到，请确保页面加载完成');
        setTimeout(() => {
            const retryDropZone = document.getElementById('message-input-container');
            const retryPreview = document.getElementById('attachment-preview');
            if (retryDropZone && retryPreview) {
                initializeDragAndDrop();
            }
        }, 1000);
        return;
    }

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', async (e) => {
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            for (const file of files) {
                try {
                    await uploader.upload(file);
                } catch (error) {
                    console.error('文件上传失败:', error);
                    showError('文件上传失败，请重试');
                }
            }
        }
    });
}

// 修改粘贴事件处理
function initializePasteHandler() {
    const messageInputContainer = document.getElementById('message-input-container');
    const userInput = document.getElementById('user-input');
    
    messageInputContainer.addEventListener('paste', async (e) => {
        const clipboardData = e.clipboardData;
        const items = Array.from(clipboardData.items);
        
        // 检查是否有文件类型的内容
        const hasFiles = items.some(item => item.kind === 'file');
        
        if (hasFiles) {
            e.preventDefault(); // 只有在有文件时才阻止默认行为
            await uploader.handlePaste(e);
        } else if (e.target !== userInput) {
            // 如果粘贴发生在输入框之外，且是文本内容，
            // 则将内容粘贴到输入框中
            e.preventDefault();
            const text = clipboardData.getData('text');
            if (text) {
                const start = userInput.selectionStart;
                const end = userInput.selectionEnd;
                const value = userInput.value;
                userInput.value = value.substring(0, start) + text + value.substring(end);
                userInput.selectionStart = userInput.selectionEnd = start + text.length;
                userInput.focus();
            }
        }
        // 如果是在输入框内的文本粘贴，让浏览器默认处理
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadConversations();
    
    // 初始化各种功能
    document.getElementById('new-chat-btn').addEventListener('click', createNewConversation);
    const attachmentTypeLoader = new AttachmentTypeLoader();
    attachmentTypeLoader.loadConfig();
    initializeDragAndDrop();
    initializePasteHandler();
    initializeTheme(); // 添加主题初始化
    initializeUserProfile(); // 添加用户配置初始化
    
    // 确保页面中所有已有的代码块都正确渲染
    document.querySelectorAll('.text-content').forEach(textContent => {
        initializeCodeBlocks(textContent);
    });
    
    // 监听模型选择变化，处理移动端选择框问题
    const modelSelectForMobile = document.getElementById('model-select');
    if (modelSelectForMobile) {
        modelSelectForMobile.addEventListener('change', function() {
            // 在移动端，选择后需要重新计算消息区域高度
            if (window.innerWidth <= 768) {
                // 延迟执行以确保DOM已更新
                setTimeout(() => {
                    adjustMessageAreaHeight();
                    hideAllDropdowns();
                }, 100);
            }
        });
    }
    
    // 运行移动端响应式测试（仅在控制台输出报告）
    if (window.innerWidth <= 768) {
        // 延迟执行测试，确保所有DOM元素都已加载
        setTimeout(() => {
            testMobileResponsive();
        }, 1000);
    }
    
    // 等待模型列表加载完成
    const modelSelect = document.getElementById('model-select');
    if (!modelSelect.options.length) {
        await new Promise(resolve => {
            const checkOptions = () => {
                if (modelSelect.options.length > 1) { // 大于1是因为有一个默认的"选择模型..."选项
                    resolve();
                } else {
                    setTimeout(checkOptions, 100);
                }
            };
            checkOptions();
        });
    }
    
    // 获取默认选项的设置
    const defaultOption = modelSelect.querySelector('option[value="grok-2-vision-1212"]');
    let maxTokens = parseInt(defaultOption?.getAttribute('data-max-output-tokens'));
    if (!maxTokens) {
        console.error('无法获取默认模型的 max_output_tokens，使用默认值4096');
        maxTokens = 4096;
    }
    const defaultTokens = Math.floor(maxTokens / 2);
    
    console.log('Initializing model settings:', {
        maxTokens,
        defaultTokens,
        defaultOption,
        rawMaxTokens: defaultOption?.getAttribute('data-max-output-tokens')
    });

    // 初始化模型设置
    window.modelSettingRenderer = new ModelSettingRenderer(
        maxTokens,
        defaultTokens,
        0.7
    );

    // 监听模型选择变化
    modelSelect.addEventListener('change', (e) => {
        const selectedOption = e.target.selectedOptions[0];
        const newMaxTokens = parseInt(selectedOption.getAttribute('data-max-output-tokens'));
        if (!newMaxTokens) {
            console.error('无法获取模型的 max_output_tokens');
            return;
        }

        console.log('Model changed:', {
            newMaxTokens,
            selectedOption,
            rawMaxTokens: selectedOption.getAttribute('data-max-output-tokens')
        });
        
        // 更新模型设置
        if (window.modelSettingRenderer) {
            // 获取当前的设置值
            const currentSettings = window.modelSettingRenderer.getSettings();
            
            // 始终重置为新模型max_token的一半
            const newCurrentTokens = Math.floor(newMaxTokens / 2);

            window.modelSettingRenderer.setSettings({
                max_output_tokens: newMaxTokens,
                default_output_tokens: Math.floor(newMaxTokens / 2),
                current_output_tokens: newCurrentTokens,  // 使用新计算的值
                temperature: currentSettings.temperature // 保持当前的温度值
            });
        }
    });
    
    // 添加系统提示词展开/收起功能
    const systemPromptHeader = document.getElementById('system-prompt-header');
    const systemPromptContainer = document.querySelector('.system-prompt-container');
    const systemPromptTextarea = document.getElementById('system-prompt');
    
    systemPromptHeader.addEventListener('click', () => {
        systemPromptContainer.classList.toggle('expanded');
        systemPromptTextarea.classList.toggle('collapsed');
        if (!systemPromptTextarea.classList.contains('collapsed')) {
            systemPromptTextarea.focus();
        }
    });
    
    // 如果没有对话，创建一个新的
    if (conversations.length === 0) {
        await createNewConversation();
    } else {
        const lastConversation = conversations[0];
        await switchConversation(lastConversation.id);
    }
    
    // 添加滚动事件监听
    chatMessages.addEventListener('scroll', () => {
        const currentScrollTop = chatMessages.scrollTop;
        
        // 如果滚动位置发生变化
        if (currentScrollTop !== lastScrollTop) {
            // 检测是否接近底部（在底部20px范围内）
            const isVeryNearBottom = chatMessages.scrollHeight - currentScrollTop - chatMessages.clientHeight < 20;
            
            // 检测是否是向上滚动（远离底部）
            const isScrollingUp = currentScrollTop < lastScrollTop;
            
            // 如果向上滚动或不在底部附近，标记为用户滚动
            if (isScrollingUp || !isVeryNearBottom) {
                userScrolling = true;
                clearTimeout(window.scrollTimeout);
                window.scrollTimeout = setTimeout(() => {
                    // 只有当停止滚动超过2秒，才重置用户滚动状态
                    userScrolling = false;
                }, 2000);
            } else if (isVeryNearBottom) {
                // 如果用户主动滚动到了底部，可以恢复自动滚动
                userScrolling = false;
            }
        }
        
        lastScrollTop = currentScrollTop;
    });

    // 页面加载完成后，将聊天区域滚动到底部
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);

    // 阻止message-input-container滑动穿透到chat-messages
    const messageInputContainer = document.getElementById('message-input-container');
    const userInput = document.getElementById('user-input');
    
    if (messageInputContainer && window.isMobile) {
        // 阻止touchmove事件冒泡，避免滑动穿透
        messageInputContainer.addEventListener('touchmove', function(e) {
            e.stopPropagation();
        }, { passive: false });
        
        // 针对用户输入文本框的特殊处理
        if (userInput) {
            userInput.addEventListener('touchmove', function(e) {
                e.stopPropagation();
            }, { passive: false });
            
            // 防止文本框滚动穿透
            userInput.addEventListener('scroll', function(e) {
                e.stopPropagation();
            }, { passive: false });
        }
    }
});

// 添加复制代码功能
function copyCode(button) {
    const pre = button.parentElement.nextElementSibling;
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
            fallbackCopyTextToClipboard(text, button);
            return;
        }
        
        navigator.clipboard.writeText(text)
            .then(() => {
                button.textContent = '已复制！';
                button.classList.add('copied');
                
                setTimeout(() => {
                    button.textContent = '复制代码';
                    button.classList.remove('copied');
                }, 2000);
            })
            .catch(err => {
                console.error('复制失败:', err);
                fallbackCopyTextToClipboard(text, button);
            });
    } catch (err) {
        console.error('复制出错:', err);
        fallbackCopyTextToClipboard(text, button);
    }
}

// 添加传统复制方法作为备选
function fallbackCopyTextToClipboard(text, button) {
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

// 确保 copyCode 函数在全局范围可用
window.copyCode = copyCode; 

// 修改重新生成消息的函数
async function regenerateMessage(messageIndex) {
    const sendButton = document.getElementById('send-button');
    if (sendButton.classList.contains('stop')) {
        sendButton.disabled = false;
        userInput.disabled = true;
    }

    // 设置内容生成状态为true
    window.isGenerating = true;
    // 重置生成停止标志
    window.generationStopped = false;
    
    try {
        console.log("进入重新生成消息的主体, 消息索引:", messageIndex);
        
        // 使用data-message-index属性获取消息元素，而不是直接用索引
        const messageDiv = document.querySelector(`[data-message-index="${messageIndex}"]`);
        if (!messageDiv) {
            console.error('找不到消息元素，索引:', messageIndex);
            return;
        }
        
        // 立即移除错误状态并添加regenerating标记
        console.log("移除错误状态并添加regenerating标记");
        messageDiv.classList.remove('error-message');
        messageDiv.classList.add('regenerating');
        
        const messageContent = messageDiv.querySelector('.message-content');
        if (!messageContent) {
            console.error('找不到消息内容元素');
            return;
        }
        
        // 清空所有内容
        console.log("清空所有内容");
        messageContent.innerHTML = '';

        // 创建思考框
        console.log("创建思考框");
        const reasoningBox = new ReasoningBox(messageContent, md);
        
        // 创建文本内容容器
        console.log("创建文本内容容器");
        const textContent = document.createElement('div');
        textContent.className = 'text-content';
        messageContent.appendChild(textContent);
        
        console.log("检查当前对话ID");
        if (!currentConversationId) {
            showError('当前对话ID不存在');
            return;
        }
        console.log("找到当前对话ID");
        const currentConversation = conversations.find(c => c.id === currentConversationId);
        if (!currentConversation) {
            showError('未找到当前对话');
            return;
        }
        
        // 验证要重新生成的消息是否存在且为助手消息或工具消息
        const message = currentConversation.messages[messageIndex];
        console.log("重新生成消息检查:", message);
        if (!message) {
            showError('无法找到要重新生成的消息');
            // 移除regenerating标记
            messageDiv.classList.remove('regenerating');
            return;
        }
        
        // 检查是否是助手消息或带有工具UI的工具消息
        if (message.role !== 'assistant' && 
            !(message.role === 'tool' && (message.display_text || message.result || message.function))) {
            showError('无法重新生成此消息');
            // 移除regenerating标记
            messageDiv.classList.remove('regenerating');
            return;
        }
        
        // 重要修复: 首先保存当前版本的后续消息，以确保在版本切换时能正确恢复
        // 获取当前的版本
        if (message.versions && message.versions[message.currentVersion]) {
            // 保存当前版本的后续消息
            message.versions[message.currentVersion].subsequentMessages = currentConversation.messages.slice(messageIndex + 1);
            console.log("已保存当前版本后续消息数量:", message.versions[message.currentVersion].subsequentMessages.length);
        }
        
        // 保存后续消息
        const subsequentMessages = currentConversation.messages.slice(messageIndex + 1);
        console.log("保存的后续消息数量:", subsequentMessages.length);
        
        // 从DOM中删除后续消息
        for (let i = messageIndex + 1; i < currentConversation.messages.length; i++) {
            const subsequentElem = document.querySelector(`.message[data-message-index="${i}"]`);
            if (subsequentElem) {
                console.log("删除后续消息DOM元素，索引:", i);
                subsequentElem.remove();
            }
        }
        
        // 获取到该消息位置的所有先前消息，包括用户和工具消息
        let messagesUntilIndex = [];
        let lastUserMessage = null;
        
        // 找到最近的用户消息和最近的用户消息之前的所有消息
        for (let i = messageIndex - 1; i >= 0; i--) {
            if (currentConversation.messages[i].role === 'user') {
                lastUserMessage = currentConversation.messages[i];
                // 收集所有直到这个用户消息（包括这个消息）的消息
                messagesUntilIndex = currentConversation.messages.slice(0, i + 1);
                break;
            }
        }
        
        // 如果没有找到用户消息，或者消息列表为空，则使用所有之前的消息
        if (!lastUserMessage || messagesUntilIndex.length === 0) {
            messagesUntilIndex = currentConversation.messages.slice(0, messageIndex);
        }
        
        console.log('最终使用的消息列表:', messagesUntilIndex);
        
        // 设置messages数组用于API请求
        messages = [
            {"role": "system", "content": currentConversation.systemPrompt || default_system_prompt},
            ...messagesUntilIndex
        ];
        
        // 禁用发送按钮，显示停止按钮
        sendButton.textContent = '停止';
        sendButton.classList.add('stop');
        sendButton.disabled = true;  // 在获取流以前先暂时禁用按钮
        userInput.disabled = false; // 允许用户提前输入
        
        try {
            // 获取选中的模型ID和图标信息
            const modelSelect = document.getElementById('model-select');
            const selectedOption = modelSelect.options[modelSelect.selectedIndex];
            const selectedModel = modelSelect.value;
            const modelIcon = selectedOption.getAttribute('data-model-icon');
            // 获取模型设置参数
            const modelSettings = window.modelSettingRenderer.getSettings();
            if (!selectedModel) {
                alert('请选择一个模型');
                return;
            }

            // 更新消息元素中的模型图标
            const iconWrapper = messageDiv.querySelector('.model-icon-wrapper');
            if (iconWrapper) {
                // 更新 data-model-icon 属性
                iconWrapper.setAttribute('data-model-icon', modelIcon);
                
                // 清空现有图标
                iconWrapper.innerHTML = '';
                
                // 创建新图标
                const iconRenderer = new IconRenderer(modelIcon);
                iconWrapper.appendChild(iconRenderer.modelIcon);
            }

            // 准备请求数据
            const requestData = { 
                messages: messages,
                conversation_id: currentConversationId,
                model_id: selectedModel,
                temperature: modelSettings.temperature,
                max_tokens: modelSettings.current_output_tokens
            };

            // 处理请求结果的回调函数
            const afterProcessCallback = async (result,messageStatus = 0) => {
                const { assistantMessage, reasoningBox, toolBoxMap, toolResult, is_valid } = result;
                
                if (is_valid) {
                    if(messageStatus == 0){
                        // 从 toolBoxMap 创建 toolBoxesData 数组
                        const toolBoxesData = [];
                        if (toolBoxMap && toolBoxMap.size > 0) {
                            toolBoxMap.forEach(toolBox => {
                                if (toolBox) {
                                    toolBoxesData.push(toolBox.serializeForStorage());
                                }
                            });
                        }
                        
                        // 确保versions数组存在
                        if (!message.versions) {
                            message.versions = [];
                        }
                        
                        // 创建新版本
                        const newVersion = {
                            content: assistantMessage,
                            reasoning_content: reasoningBox ? reasoningBox.getContent() : null,
                            reasoning_summary: reasoningBox ? reasoningBox.getSummary() : null, 
                            thinking_time: reasoningBox ? reasoningBox.getThinkingTime() : null,
                            tool_boxes: toolBoxesData,
                            attachments: [],
                            subsequentMessages: JSON.parse(JSON.stringify(subsequentMessages)), // 深拷贝后续消息
                            modelIcon: modelIcon,
                            modelId: selectedModel,
                            tool_results: toolResult || [] // 初始化tool_results为工具结果或空数组
                        };
                        // 添加到版本历史
                        message.versions.push(newVersion);
                        message.currentVersion = message.versions.length - 1;
                        
                        // 更新主消息字段
                        message.content = assistantMessage;
                        message.modelIcon = modelIcon;
                        message.modelId = selectedModel;
                        message.reasoning_content = reasoningBox ? reasoningBox.getContent() : null;
                        message.reasoning_summary = reasoningBox ? reasoningBox.getSummary() : null;
                        message.thinking_time = reasoningBox ? reasoningBox.getThinkingTime() : null;
                        message.tool_boxes = toolBoxesData;
                        message.attachments = [];
                        
                        // 清除当前对话中这条消息后的所有消息
                        currentConversation.messages = currentConversation.messages.slice(0, messageIndex + 1);
                    }
                    else if(messageStatus == -1){
                        // 更新UI，添加版本控制
                        const messageWrapper = messageDiv.querySelector('.message-wrapper');
                        const messageActions = messageWrapper.querySelector('.message-actions');
                        messageActions.innerHTML = '';
                        
                        // 先添加重新生成按钮
                        createRegenerateButton(messageIndex, messageActions, false);
                        
                        // 再添加版本控制
                        if (message.versions.length > 1) {
                            createVersionControl(messageIndex, messageActions, message);
                        }
                    }
                    else if(messageStatus == 1){
                        //处理中间消息
                        const thinking_time = reasoningBox ? reasoningBox.getThinkingTime() : 0;
                        const reasoning_summary = reasoningBox ? reasoningBox.getSummary() : null;
                        
                        // 收集工具框数据
                        const toolBoxesData = [];
                        if (toolBoxMap && toolBoxMap.size > 0) {
                            toolBoxMap.forEach((toolBox, toolCallId) => {
                                if (toolBox) {
                                    toolBoxesData.push(toolBox.serializeForStorage());
                                }
                            });
                        }

                        // 检查tool_results是否存在，不存在则初始化为空数组
                        if (!currentConversation.messages.at(-1).tool_results) {
                            currentConversation.messages.at(-1).tool_results = [];
                        }
                        
                        currentConversation.messages.at(-1).tool_results = currentConversation.messages.at(-1).tool_results.concat(toolResult);
                        currentConversation.messages.at(-1).tool_boxes = toolBoxesData;
                        currentConversation.messages.at(-1).reasoning_summary = reasoning_summary;
                        currentConversation.messages.at(-1).thinking_time = thinking_time;
                        currentConversation.messages.at(-1).reasoning_content = reasoningBox ? reasoningBox.getContent() : null;
                        currentConversation.messages.at(-1).content = assistantMessage;
                        currentConversation.messages.at(-1).versions.at(-1).tool_boxes = toolBoxesData;
                        currentConversation.messages.at(-1).versions.at(-1).reasoning_content = reasoningBox ? reasoningBox.getContent() : null;
                        currentConversation.messages.at(-1).versions.at(-1).reasoning_summary = reasoning_summary;
                        currentConversation.messages.at(-1).versions.at(-1).thinking_time = thinking_time;
                        currentConversation.messages.at(-1).versions.at(-1).content = assistantMessage;
                        currentConversation.messages.at(-1).isInterrupted = window.generationStopped;
                    }
                    // // 更新全局messages数组中的最后一条助手消息
                    // if (messages.length > 0) {
                    //     // 查找最后一条助手消息
                    //     for (let i = messages.length - 1; i >= 0; i--) {
                    //         if (messages[i].role === 'assistant') {
                    //             // 更新消息内容
                    //             messages[i].content = assistantMessage;
                    //             break;
                    //         }
                    //     }
                    // }
                    //每次处理完消息后，保存一次对话
                    await saveConversation(currentConversation.id, 'update');
                }
            };

            // 使用公共函数处理消息请求
            await handleMessageRequest(
                requestData,
                messageDiv,
                messageContent,
                {
                    messageIndex,
                    md,
                    chatMessages,
                    shouldScrollToBottom: false,
                    afterProcessCallback
                }
            );
            
            // 移除regenerating标记
            messageDiv.classList.remove('regenerating');
            
        } catch (error) {
            // 清理状态
            messageDiv.classList.add('error-message');
            // 移除regenerating标记
            messageDiv.classList.remove('regenerating');
            messageContent.innerHTML = md.render('发生错误，请重试\n'+error.message);
            
            // 重新创建重新生成按钮
            const messageWrapper = messageDiv.querySelector('.message-wrapper');
            const messageActions = messageWrapper.querySelector('.message-actions');
            messageActions.innerHTML = '';
            createRegenerateButton(messageIndex, messageActions, true);
            throw error;
        }
    } finally {
        // 清理状态
        if (currentReader) {
            try {
                await currentReader.cancel();
            } catch (e) {
                console.log('Error cancelling stream:', e);
            }
            currentReader = null;
        }
        userInput.disabled = false;
        console.log("发送按钮触发4");
        sendButton.textContent = '发送';
        sendButton.classList.remove('stop');
        if(!canSendMessage()){
            sendButton.disabled = true;
        }else{
            sendButton.disabled = false;
        }
        
        // 重置内容生成状态
        window.isGenerating = false;
    }
}

// 修改 editUserMessage 函数
async function editUserMessage(messageIndex, originalContent) {
    const messageDiv = document.querySelector(`[data-message-index="${messageIndex}"]`);
    if (!messageDiv) {
        console.error('未找到消息元素');
        return;
    }

    // 从当前对话中获取消息
    const currentConversation = conversations.find(c => c.id === currentConversationId);
    if (!currentConversation) {
        console.error('未找到当前对话');
        return;
    }

    // 获取原始消息
    const originalMessage = currentConversation.messages[messageIndex];
    if (!originalMessage) {
        console.error('未找到消息');
        return;
    }

    // 检查消息角色
    if (originalMessage.role !== 'user') {
        console.error('只能编辑用户消息');
        return;
    }

    console.log('获取到的原始消息:', originalMessage);  // 调试日志
    
    // 隐藏原有内容和附件容器
    const messageWrapper = messageDiv.querySelector('.message-wrapper');
    const originalContentDiv = messageWrapper.querySelector('.message-content');
    const originalAttachmentsContainer = messageDiv.querySelector('.message-attachments-container');
    const editButton = messageWrapper.querySelector('.edit-btn');  // 获取编辑按钮
    
    if (originalContentDiv) {
        originalContentDiv.style.display = 'none';
    }
    if (originalAttachmentsContainer) {
        originalAttachmentsContainer.style.display = 'none';
    }
    if (editButton) {  // 隐藏编辑按钮
        editButton.style.display = 'none';
    }
    
    // 创建编辑容器
    const editContainer = document.createElement('div');
    editContainer.className = 'edit-container';
    
    // 创建文本编辑区
    const textarea = document.createElement('textarea');
    textarea.className = 'edit-textarea';
    textarea.value = originalContent;
    
    // 创建附件编辑容器
    const attachmentsContainer = document.createElement('div');
    attachmentsContainer.className = 'edit-attachments-container';
    
    // 修改 uploader 的配置，添加回调函数
    const uploader = new Uploader({
        container: attachmentsContainer,
        onDelete: (attachment) => {
            console.log('删除附件:', attachment);
            uploader.removeAttachment(attachment);
            // 检查是否还有附件，如果没有则隐藏容器
            if (uploader.getAttachments().length === 0) {
                attachmentsContainer.style.display = 'none';
            }
        },
        onUploadSuccess: (attachment) => {
            console.log('文件上传成功:', attachment);
            // 显示附件容器
            attachmentsContainer.style.display = 'flex';
        }
    });
    
    // 确保上传器完全初始化
    await uploader.initialize();
    console.log('上传器初始化完成，可用上传器:', [...uploader.uploaders.keys()]);

    // 如果有原有附件，加载到编辑器中
    if (originalMessage.attachments && originalMessage.attachments.length > 0) {
        console.log('开始加载原有附件:', originalMessage.attachments);
        attachmentsContainer.style.display = 'flex';
        
        for (const attachment of originalMessage.attachments) {
            try {
                console.log('处理附件:', attachment);
                console.log('附件类型:', attachment.type);
                console.log('附件MIME类型:', attachment.mime_type);
                console.log('附件时长:', attachment.duration);
                console.log('附件缩略图:', attachment.thumbnail);
                
                // 确保附件对象包含所有必要的属性
                const fullAttachment = {
                    ...attachment,
                    // 确保type是小写的，并处理可能的大小写不一致问题
                    type: (attachment.type || (attachment.mime_type?.startsWith('video/') ? 'video' : 'image')).toLowerCase(),
                    base64_id: attachment.base64_id,
                    fileName: attachment.fileName,
                    mime_type: attachment.mime_type,
                    file_path: attachment.file_path,
                    // 视频特有属性
                    duration: attachment.duration,
                    thumbnail: attachment.thumbnail,
                    // 文本附件特有属性
                    content_id: attachment.content_id,
                    encoding: attachment.encoding || 'UTF-8',
                    lineCount: attachment.lineCount || 0,
                    size: attachment.size || 0,
                    // 在编辑模式下允许删除
                    disableDelete: false
                };
                
                console.log('处理后的完整附件:', fullAttachment);
                await uploader.addExistingAttachment(fullAttachment);
            } catch (error) {
                console.error('处理原有附件失败:', error);
                console.error('附件数据:', attachment);
                showError('加载原有附件失败');
            }
        }
    } else {
        console.log('没有找到原有附件，原始消息:', originalMessage);
        attachmentsContainer.style.display = 'none';
    }

    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'edit-buttons';
    
    // 添加文件选择按钮
    const addFileButton = document.createElement('button');
    addFileButton.textContent = '添加附件';
    addFileButton.onclick = () => uploader.selectFiles();
    
    // 保存按钮
    const saveButton = document.createElement('button');
    saveButton.textContent = '保存';
    saveButton.onclick = async () => {
        const editedContent = textarea.value.trim();
        const hasAttachments = uploader.getAttachments().length > 0;
        
        // 修改判断条件：只有当既没有文本内容也没有附件时才提示错误
        if (!editedContent && !hasAttachments) {
            showError('消息内容和附件不能同时为空');
            return;
        }
        
        try {
            saveButton.disabled = true;
            saveButton.textContent = '保存中...';
            
            // 获取所有附件
            const attachments = uploader.getAttachments().map(attachment => {
                console.log('收集附件:', attachment);
                console.log('附件类型:', attachment.type);
                console.log('附件方法:', {
                    getBase64Id: attachment.getBase64Id?.(),
                    getFileName: attachment.getFileName?.(),
                    getMimeType: attachment.getMimeType?.(),
                    getFilePath: attachment.getFilePath?.(),
                    getDuration: attachment.getDuration?.(),
                    getThumbnail: attachment.getThumbnail?.()
                });
                
                // 根据附件类型返回不同的数据结构
                if (attachment.type === 'text') {
                    return {
                        type: 'text',
                        fileName: attachment.getFileName ? attachment.getFileName() : attachment.fileName,
                        mime_type: attachment.getMimeType ? attachment.getMimeType() : attachment.mime_type,
                        file_path: attachment.getFilePath ? attachment.getFilePath() : attachment.file_path,
                        content_id: attachment.content_id || attachment.getFilePath?.(),
                        encoding: attachment.encoding || 'UTF-8',
                        lineCount: attachment.lineCount || 0,
                        size: attachment.size || 0
                    };
                } else if (attachment.type === 'video') {
                    return {
                        type: 'video',
                        base64_id: attachment.getBase64Id?.(),
                        fileName: attachment.getFileName(),
                        mime_type: attachment.getMimeType(),
                        file_path: attachment.getFilePath(),
                        duration: attachment.getDuration?.() || undefined,
                        thumbnail: attachment.getThumbnail?.() || undefined
                    };
                } else {
                    // 默认图片或其他类型
                    return {
                        type: attachment.type || (attachment.getMimeType?.()?.startsWith('video/') ? 'video' : 'image'),
                        base64_id: attachment.getBase64Id?.(),
                        fileName: attachment.getFileName(),
                        mime_type: attachment.getMimeType(),
                        file_path: attachment.getFilePath()
                    };
                }
            });
            
            console.log('收集到的所有附件:', attachments);
            
            // 更新消息数组中的内容
            const updatedMessage = {
                ...originalMessage,
                content: editedContent,
                attachments: attachments
            };

            // 获取并验证当前对话
            const conversation = conversations.find(c => c.id === currentConversationId);
            if (!conversation) {
                throw new Error('当前对话不存在');
            }

            if (!conversation.messages[messageIndex]) {
                throw new Error('消息索引无效');
            }

            // 更新消息
            conversation.messages[messageIndex] = updatedMessage;
            // 同步更新全局消息数组
            messages = [
                {"role": "system", "content": conversation.systemPrompt || default_system_prompt},
                ...conversation.messages
            ];
            
            // 更新UI显示
            originalContentDiv.style.display = '';
            if (originalAttachmentsContainer) {
                originalAttachmentsContainer.style.display = '';
            }
            if (editButton) {
                editButton.style.display = '';
            }
            
            // 更新文本内容
            const textContent = document.createElement('div');
            textContent.className = 'text-content';
            textContent.textContent = editedContent;
            originalContentDiv.innerHTML = '';
            originalContentDiv.appendChild(textContent);
            
            // 更新附件显示
            if (attachments.length > 0) {
                let attachmentsDiv;
                if (originalAttachmentsContainer) {
                    attachmentsDiv = originalAttachmentsContainer;
                    attachmentsDiv.innerHTML = '';
                } else {
                    attachmentsDiv = document.createElement('div');
                    attachmentsDiv.className = 'message-attachments-container';
                    messageDiv.appendChild(attachmentsDiv);
                }
                
                const attachmentRenderer = new AttachmentRenderer();
                const renderPromises = attachments.map(async (attachment) => {
                    try {
                        // 确保传递所有必要属性，特别是文本附件的content_id
                        const renderedElement = await attachmentRenderer.render({
                            type: attachment.type || 'image',
                            base64_id: attachment.base64_id,
                            filename: attachment.fileName,
                            file_path: attachment.file_path,
                            mime_type: attachment.mime_type,
                            content_id: attachment.content_id, // 添加content_id属性
                            encoding: attachment.encoding,     // 添加编码属性
                            lineCount: attachment.lineCount,   // 添加行数属性
                            size: attachment.size,             // 添加大小属性
                            disableDelete: true,
                            duration: attachment.duration,
                            thumbnail_base64_id: attachment.thumbnail_base64_id
                        });
                        
                        if (renderedElement) {
                            attachmentsDiv.appendChild(renderedElement);
                        }
                    } catch (error) {
                        console.error('渲染附件失败:', error);
                        showToast('附件渲染失败', 'error');
                    }
                });
                
                await Promise.all(renderPromises);
            } else if (originalAttachmentsContainer) {
                originalAttachmentsContainer.remove();
            }
            
            // 保存对话
            await saveConversation(conversation.id, 'update');
            
            // 显示成功提示
            showToast('编辑已保存');
            
            // 移除编辑容器
            editContainer.remove();

            // 自动触发重新生成
            // 找到当前消息之后的第一个助手消息并重新生成
            const conversationMessages = conversation.messages;
            for (let i = messageIndex + 1; i < conversationMessages.length; i++) {
                if (conversationMessages[i].role === 'assistant') {
                    console.log('找到需要重新生成的助手消息，索引:', i);
                    
                    // 直接调用regenerateMessage函数进行重新生成
                    await regenerateMessage(i);
                    break;
                }
            }
            
        } catch (error) {
            console.error('保存编辑失败:', error);
            showError('保存失败，请重试');
            return;
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = '保存';
        }
    };
    
    // 取消按钮
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消';
    cancelButton.onclick = () => {
        if (confirm('确定要取消编辑吗？所有更改都将丢失。')) {
            editContainer.remove();
            originalContentDiv.style.display = '';
            if (originalAttachmentsContainer) {
                originalAttachmentsContainer.style.display = '';
            }
            if (editButton) {
                editButton.style.display = '';
            }
        }
    };
    
    // 组装编辑容器
    editContainer.appendChild(attachmentsContainer);  // 附件预览区放在最上面
    editContainer.appendChild(textarea);             // 文本编辑区放在中间
    editContainer.appendChild(buttonContainer);      // 按钮放在最下面
    
    // 按钮容器中的按钮顺序调整
    buttonContainer.appendChild(addFileButton);      // 添加附件按钮
    buttonContainer.appendChild(saveButton);         // 保存按钮
    buttonContainer.appendChild(cancelButton);       // 取消按钮
    
    // 在消息内容之后插入编辑容器
    messageWrapper.insertBefore(editContainer, originalContentDiv.nextSibling);
    
    // 聚焦到文本框
    textarea.focus();
}

// 添加切换版本的函数
async function switchVersion(messageIndex, newVersion) {
    // 获取当前对话
    const currentConversation = conversations.find(c => c.id === currentConversationId);
    if (!currentConversation || !currentConversation.messages[messageIndex]) {
        console.error('消息索引无效或对话不存在');
        return;
    }
    
    const message = currentConversation.messages[messageIndex];
    
    // 检查版本是否存在
    if (!message.versions || !message.versions[newVersion]) {
        console.error('指定的版本不存在');
        return;
    }
    
    // 保存当前的滚动位置
    const chatMessages = document.getElementById('chat-messages');
    const currentScrollPosition = chatMessages.scrollTop;
    
    // 重要修复: 首先保存当前版本的后续消息，以便将来切换回来
    if (message.versions && message.versions[message.currentVersion]) {
        message.versions[message.currentVersion].subsequentMessages = currentConversation.messages.slice(messageIndex + 1);
        console.log("切换前保存当前版本后续消息数量:", message.versions[message.currentVersion].subsequentMessages.length);
    }
    
    // 更新当前版本
    message.currentVersion = newVersion;
    
    // 更新UI - 先找到对应的消息DOM元素
    const messageElem = document.querySelector(`.message[data-message-index="${messageIndex}"]`);
    if (!messageElem) {
        console.error('找不到对应的消息元素');
        return;
    }
    
    // 获取新版本的数据
    const newVersionData = message.versions[newVersion];
    
    // 更新消息的内容
    const messageContent = messageElem.querySelector('.message-content');
    if (messageContent) {
        // 清空现有内容
        messageContent.innerHTML = '';
        
        // 初始化Markdown渲染器
        const md = initMarkdownit();
        
        // 恢复思考框（如果有）
        if (newVersionData.reasoning_content) {
            const reasoningBox = new ReasoningBox(messageContent, md);
            reasoningBox.setContent(newVersionData.reasoning_content);
            reasoningBox.markGenerationComplete();
            
            // 设置思考时间（如果有）
            if (newVersionData.thinking_time) {
                reasoningBox.setThinkingTime(newVersionData.thinking_time);
            }
        }
        
        // 创建文本内容
        if (newVersionData.content) {
            const textContentDiv = document.createElement('div');
            textContentDiv.className = 'text-content';
            textContentDiv.innerHTML = md.render(newVersionData.content);
            
            // 初始化代码块
            initializeCodeBlocks(textContentDiv);
            
            messageContent.appendChild(textContentDiv);
        }
        
        // 恢复工具框（如果有）
        if (newVersionData.tool_boxes && Array.isArray(newVersionData.tool_boxes)) {
            for (const toolBoxData of newVersionData.tool_boxes) {
                if (toolBoxData) {
                    try {
                        // 使用工具框的静态方法创建工具框
                        ToolBox.createFromSerializedData(messageContent, md, toolBoxData);
                    } catch (e) {
                        console.error('恢复工具框失败:', e);
                    }
                }
            }
        }
    }
    
    // 处理后续消息
    if (newVersionData.subsequentMessages && Array.isArray(newVersionData.subsequentMessages)) {
        console.log('从版本数据中恢复后续消息，数量:', newVersionData.subsequentMessages.length);
        
        // 从UI中删除后续消息DOM元素
        for (let i = messageIndex + 1; i < currentConversation.messages.length; i++) {
            const subsequentElem = document.querySelector(`.message[data-message-index="${i}"]`);
            if (subsequentElem) {
                console.log('删除后续消息DOM元素，索引:', i);
                subsequentElem.remove();
            }
        }
        
        // 更新对话数据，保留当前消息及之前的消息
        currentConversation.messages = currentConversation.messages.slice(0, messageIndex + 1);
        
        // 恢复保存的后续消息
        for (let i = 0; i < newVersionData.subsequentMessages.length; i++) {
            const subMsg = newVersionData.subsequentMessages[i];
            // 添加到消息数组
            currentConversation.messages.push(JSON.parse(JSON.stringify(subMsg))); // 深拷贝以避免引用问题
            
            // 计算新消息的索引
            const newIndex = messageIndex + 1 + i;
            
            // 确定模型信息
            let modelInfo = null;
            if (subMsg.modelIcon) {
                modelInfo = subMsg.modelIcon;
            } else if (subMsg.modelId) {
                modelInfo = subMsg.modelId;
            }
            
            // 在UI中添加消息
            appendMessage(
                subMsg.content,
                subMsg.role === 'user',
                newIndex,
                subMsg.attachments || [],
                modelInfo,
                false
            );
            
            // 如果是助手消息且有多个版本，为其添加版本控制
            if ((subMsg.role === 'assistant' || 
                (subMsg.role === 'tool' && (subMsg.display_text || subMsg.result || subMsg.function))) && 
                subMsg.versions && subMsg.versions.length > 1) {
                
                const subMsgElem = document.querySelector(`.message[data-message-index="${newIndex}"]`);
                if (subMsgElem) {
                    const subMsgWrapper = subMsgElem.querySelector('.message-wrapper');
                    if (subMsgWrapper) {
                        const subMsgActions = subMsgWrapper.querySelector('.message-actions');
                        if (subMsgActions) {
                            // 清空现有按钮，防止重复创建
                            subMsgActions.innerHTML = '';
                            // 先添加重新生成按钮
                            createRegenerateButton(newIndex, subMsgActions, false);
                            // 再添加版本控制
                            createVersionControl(newIndex, subMsgActions, subMsg);
                        }
                    }
                }
            }
        }
    }
    
    // 更新版本控制UI
    const messageActions = messageElem.querySelector('.message-actions');
    if (messageActions) {
        // 清空所有现有控件
        messageActions.innerHTML = '';
        
        // 先添加重新生成按钮
        createRegenerateButton(messageIndex, messageActions, false);
        
        // 再重新创建版本控制
        createVersionControl(messageIndex, messageActions, message);
    }
    
    // 更新模型图标
    if (newVersionData.modelIcon) {
        const iconWrapper = messageElem.querySelector('.model-icon-wrapper');
        if (iconWrapper) {
            // 更新数据属性
            iconWrapper.setAttribute('data-model-icon', newVersionData.modelIcon);
            
            // 清空现有图标
            iconWrapper.innerHTML = '';
            
            // 创建新图标
            const iconRenderer = new IconRenderer(newVersionData.modelIcon);
            iconWrapper.appendChild(iconRenderer.modelIcon);
        }
    }
    
    // 恢复滚动位置
    chatMessages.scrollTop = currentScrollPosition;
    
    // 保存对话
    await saveConversation(currentConversation.id, 'update');
}

// 添加系统提示词变更监听
document.addEventListener('DOMContentLoaded', () => {
    // ... 现有的 DOMContentLoaded 代码 ...

    // 添加系统提示词变更事件监听
    const systemPromptTextarea = document.getElementById('system-prompt');
    let saveTimeout;
    
    systemPromptTextarea.addEventListener('input', () => {
        // 使用防抖处理，避免频繁保存
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            if (currentConversationId) {
                const currentConversation = conversations.find(c => c.id === currentConversationId);
                if (currentConversation) {
                    currentConversation.systemPrompt = systemPromptTextarea.value; // 更新系统提示词
                    messages[0] = {"role": "system", "content": currentConversation.systemPrompt || default_system_prompt}; // 只在发送消息时使用默认提示词
                    await saveConversation(currentConversation.id, 'update');
                }
            }
        }, 1000); // 1秒后保存
    });
});

// 添加生成标题的函数
async function generateTitle(firstMessage) {
    try {
        console.log('开始生成标题，消息内容:', firstMessage); 
        const response = await fetch('/generate_title', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                message: firstMessage?.trim() || '附件对话',  // 如果没有文本消息则使用默认描述
                model_id: 'gemini-1.5-flash-8b',
                max_tokens: 50
            })
        });

        if (!response.ok) {
            console.error('生成标题失败，状态码:', response.status);
            const errorData = await response.json();
            console.error('错误详情:', errorData);
            return firstMessage?.slice(0, 20) || '图片对话';
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let title = '';
        const conversationItem = document.querySelector(`.conversation-item[data-id="${currentConversationId}"]`);
        const titleElement = conversationItem?.querySelector('.conversation-title');

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.content) {
                            title += data.content;
                            if (titleElement) {
                                titleElement.textContent = title;
                            }
                        }
                    } catch (e) {
                        console.error('解析标题SSE数据出错:', e, '原始数据:', line);
                    }
                }
            }
        }

        // 更新对话标题
        title = title.trim() || firstMessage?.slice(0, 20) || '图片对话';
        if (firstMessage?.length > 20) {
            title += '...';
        }
        
        const currentConversation = conversations.find(c => c.id === currentConversationId);
        if (currentConversation) {
            currentConversation.title = title;
            await saveConversation(currentConversation.id, 'update');
        }

        return title;
    } catch (error) {
        console.error('生成标题失败:', error);
        return firstMessage?.slice(0, 20) || '附件对话';
    }
}

// 添加编辑对话标题的函数
function editConversationTitle(conversationId) {
    const conversationItem = document.querySelector(`.conversation-item[data-id="${conversationId}"]`);
    const titleContainer = conversationItem.querySelector('.conversation-title-container');
    const titleElement = titleContainer.querySelector('.conversation-title');
    const currentTitle = titleElement.textContent;
    
    // 创建输入框
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-title-input';
    input.value = currentTitle;
    
    // 替换标题元素
    titleContainer.replaceChild(input, titleElement);
    input.focus();
    input.select();
    
    // 处理保存
    const saveTitle = async () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentTitle) {
            const conversation = conversations.find(c => c.id === conversationId);
            if (conversation) {
                conversation.title = newTitle;
                await saveConversation(conversation.id, 'update');
            }
        }
        titleElement.textContent = newTitle || currentTitle;
        titleContainer.replaceChild(titleElement, input);
    };
    
    // 监听事件
    input.onblur = saveTitle;
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveTitle();
        } else if (e.key === 'Escape') {
            titleElement.textContent = currentTitle;
            titleContainer.replaceChild(titleElement, input);
        }
    };
}

// 添加新的函数用于处理临时错误消息的重新生成
async function regenerateErrorMessage(messageIndex) {
    const sendButton = document.getElementById('send-button');
    if (sendButton.classList.contains('stop')) {
        sendButton.disabled = false;
        userInput.disabled = true;
    }

    // 设置内容生成状态为true
    window.isGenerating = true;
    
    try {
        // 获取当前消息元素
        const messageDiv = document.querySelector(`[data-message-index="${messageIndex}"]`);
        if (!messageDiv) {
            console.error('找不到消息元素');
            return;
        }
        
        // 立即移除错误状态并添加regenerating标记
        messageDiv.classList.remove('error-message');
        messageDiv.classList.add('regenerating');
        
        const messageContent = messageDiv.querySelector('.message-content');
        if (!messageContent) {
            console.error('找不到消息内容元素');
            return;
        }
        
        // 清空所有内容
        messageContent.innerHTML = '';
        
        // 创建思考框
        const reasoningBox = new ReasoningBox(messageContent, md);
        
        // 创建文本内容容器
        const textContent = document.createElement('div');
        textContent.className = 'text-content';
        messageContent.appendChild(textContent);
        
        if (!currentConversationId) {
            showError('当前对话ID不存在');
            return;
        }
        
        const currentConversation = conversations.find(c => c.id === currentConversationId);
        if (!currentConversation) {
            showError('未找到当前对话');
            return;
        }
        
        // 重要修复: 获取当前消息，如果存在且有版本，保存当前版本的后续消息
        if (messageIndex < currentConversation.messages.length) {
            const message = currentConversation.messages[messageIndex];
            if (message && message.versions && message.versions[message.currentVersion]) {
                message.versions[message.currentVersion].subsequentMessages = currentConversation.messages.slice(messageIndex + 1);
                console.log("已保存当前版本后续消息数量:", message.versions[message.currentVersion].subsequentMessages.length);
            }
        }
        
        // 保存后续消息
        const subsequentMessages = currentConversation.messages.slice(messageIndex + 1);
        console.log("保存的后续消息数量:", subsequentMessages.length);
        
        // 从DOM中删除后续消息
        for (let i = messageIndex + 1; i < currentConversation.messages.length; i++) {
            const subsequentElem = document.querySelector(`.message[data-message-index="${i}"]`);
            if (subsequentElem) {
                console.log("删除后续消息DOM元素，索引:", i);
                subsequentElem.remove();
            }
        }
        
        // 确保我们只使用到用户的最后一条消息
        // 如果 messageIndex 大于实际消息数量，说明这是自动添加的错误消息
        // 这种情况下，我们应该使用到最后一条用户消息为止的所有消息
        const actualMessages = currentConversation.messages;
        const messagesUntilIndex = actualMessages.slice(0, messageIndex);
        console.log('Messages until index:', messagesUntilIndex.length); // 调试日志
        
        // 设置messages数组用于API请求
        messages = [
            {"role": "system", "content": currentConversation.systemPrompt || default_system_prompt},
            ...messagesUntilIndex
        ];
        
        // 禁用发送按钮，显示停止按钮
        sendButton.textContent = '停止';
        sendButton.classList.add('stop');
        sendButton.disabled = true;  // 在获取流以前先暂时禁用按钮
        userInput.disabled = false;  // 允许用户提前输入
        
        try {
            // 获取选中的模型ID和图标信息
            const modelSelect = document.getElementById('model-select');
            const selectedOption = modelSelect.options[modelSelect.selectedIndex];
            const selectedModel = modelSelect.value;
            const modelIcon = selectedOption.getAttribute('data-model-icon');
            // 获取模型设置参数
            const modelSettings = window.modelSettingRenderer.getSettings();
            if (!selectedModel) {
                alert('请选择一个模型');
                return;
            }

            // 更新消息元素中的模型图标
            const iconWrapper = messageDiv.querySelector('.model-icon-wrapper');
            if (iconWrapper) {
                // 更新 data-model-icon 属性
                iconWrapper.setAttribute('data-model-icon', modelIcon);
                
                // 清空现有图标
                iconWrapper.innerHTML = '';
                
                // 创建新图标
                const iconRenderer = new IconRenderer(modelIcon);
                iconWrapper.appendChild(iconRenderer.modelIcon);
            }

            // 准备请求数据
            const requestData = { 
                messages: messages,
                conversation_id: currentConversationId,
                model_id: selectedModel,
                temperature: modelSettings.temperature,
                max_tokens: modelSettings.current_output_tokens
            };

            // 处理请求结果的回调函数
            const afterProcessCallback = async (result,messageStatus = 0) => {
                const { assistantMessage, reasoningBox, toolBoxMap, toolResult, is_valid } = result;
                
                if (is_valid) {
                    let message = currentConversation.messages[messageIndex];
                    if(messageStatus == 0){
                        // 获取当前消息对象，如果不存在则创建一个新的
                        if (!message) {
                            message = {
                                role: 'assistant',
                                content: '',
                                versions: []
                            };
                            currentConversation.messages[messageIndex] = message;
                        }
                        
                        // 从 toolBoxMap 创建 toolBoxesData 数组
                        const toolBoxesData = [];
                        if (toolBoxMap && toolBoxMap.size > 0) {
                            toolBoxMap.forEach(toolBox => {
                                if (toolBox) {
                                    toolBoxesData.push(toolBox.serializeForStorage());
                                }
                            });
                        }
                        
                        // 创建新版本
                        const newVersion = {
                            content: assistantMessage,
                            reasoning_content: reasoningBox ? reasoningBox.getContent() : null,
                            reasoning_summary: reasoningBox ? reasoningBox.getSummary() : null, 
                            thinking_time: reasoningBox ? reasoningBox.getThinkingTime() : null,
                            tool_boxes: toolBoxesData,
                            attachments: [],
                            subsequentMessages: JSON.parse(JSON.stringify(subsequentMessages)), // 深拷贝后续消息
                            modelIcon: modelIcon,
                            modelId: selectedModel,
                            tool_results: toolResult || [] // 初始化tool_results为工具结果或空数组
                        };
                        
                        // 初始化versions数组(如果不存在)
                        if (!message.versions) {
                            message.versions = [];
                        }
                        
                        // 添加到版本历史
                        message.versions.push(newVersion);
                        message.currentVersion = message.versions.length - 1;
                        
                        // 更新主消息
                        message.content = assistantMessage;
                        message.modelIcon = modelIcon;
                        message.modelId = selectedModel;
                        message.reasoning_content = reasoningBox ? reasoningBox.getContent() : null;
                        message.reasoning_summary = reasoningBox ? reasoningBox.getSummary() : null;
                        message.thinking_time = reasoningBox ? reasoningBox.getThinkingTime() : null;
                        message.attachments = newVersion.attachments;
                        
                        // 清除当前对话中这条消息后的所有消息
                        currentConversation.messages = currentConversation.messages.slice(0, messageIndex + 1);
                    }
                    else if(messageStatus == -1){
                        // 更新UI，添加版本控制
                        const messageWrapper = messageDiv.querySelector('.message-wrapper');
                        const messageActions = messageWrapper.querySelector('.message-actions');
                        messageActions.innerHTML = '';
                        
                        // 先添加重新生成按钮
                        createRegenerateButton(messageIndex, messageActions, false);
                        
                        // 再添加版本控制
                        if (message.versions.length > 1) {
                            createVersionControl(messageIndex, messageActions, message);
                        }
                    }
                    else if(messageStatus == 1){
                        //处理中间消息
                        const thinking_time = reasoningBox ? reasoningBox.getThinkingTime() : 0;
                        const reasoning_summary = reasoningBox ? reasoningBox.getSummary() : null;
                        
                        // 收集工具框数据
                        const toolBoxesData = [];
                        if (toolBoxMap && toolBoxMap.size > 0) {
                            toolBoxMap.forEach((toolBox, toolCallId) => {
                                if (toolBox) {
                                    toolBoxesData.push(toolBox.serializeForStorage());
                                }
                            });
                        }

                        // 检查tool_results是否存在，不存在则初始化为空数组
                        if (!currentConversation.messages.at(-1).tool_results) {
                            currentConversation.messages.at(-1).tool_results = [];
                        }
                        
                        currentConversation.messages.at(-1).tool_results = currentConversation.messages.at(-1).tool_results.concat(toolResult);
                        currentConversation.messages.at(-1).tool_boxes = toolBoxesData;
                        currentConversation.messages.at(-1).reasoning_summary = reasoning_summary;
                        currentConversation.messages.at(-1).thinking_time = thinking_time;
                        currentConversation.messages.at(-1).reasoning_content = reasoningBox ? reasoningBox.getContent() : null;
                        currentConversation.messages.at(-1).content = assistantMessage;
                        currentConversation.messages.at(-1).versions.at(-1).tool_boxes = toolBoxesData;
                        currentConversation.messages.at(-1).versions.at(-1).reasoning_content = reasoningBox ? reasoningBox.getContent() : null;
                        currentConversation.messages.at(-1).versions.at(-1).reasoning_summary = reasoning_summary;
                        currentConversation.messages.at(-1).versions.at(-1).thinking_time = thinking_time;
                        currentConversation.messages.at(-1).versions.at(-1).content = assistantMessage;
                        currentConversation.messages.at(-1).isInterrupted = window.generationStopped;
                    }
                    // // 更新全局messages数组中的最后一条助手消息
                    // if (messages.length > 0) {
                    //     // 查找最后一条助手消息
                    //     for (let i = messages.length - 1; i >= 0; i--) {
                    //         if (messages[i].role === 'assistant') {
                    //             // 更新消息内容
                    //             messages[i].content = assistantMessage;
                    //             break;
                    //         }
                    //     }
                    // }
                    //每次处理完消息后，保存一次对话
                    await saveConversation(currentConversation.id, 'update');
                }
            };

            // 使用公共函数处理消息请求
            await handleMessageRequest(
                requestData,
                messageDiv,
                messageContent,
                {
                    messageIndex,
                    md,
                    chatMessages,
                    shouldScrollToBottom: false,
                    isErrorRegeneration: true,
                    afterProcessCallback
                }
            );
            
            // 移除regenerating标记
            messageDiv.classList.remove('regenerating');
            
        } catch (error) {
            // 错误处理在handleMessageRequest中已完成
            throw error;
        }
    } finally {
        // 清理状态
        if (currentReader) {
            try {
                await currentReader.cancel();
            } catch (e) {
                console.log('Error cancelling stream:', e);
            }
            currentReader = null;
        }
        userInput.disabled = false;
        sendButton.textContent = '发送';
        sendButton.classList.remove('stop');
        if(!canSendMessage()){
            sendButton.disabled = true;
        }else{
            sendButton.disabled = false;
        }
        
        // 重置内容生成状态
        window.isGenerating = false;
    }
}

// 添加一个确保滚动到底部的函数
function ensureScrollToBottom(container) {
    if (shouldAutoScroll(container)) {
        // 计算需要额外滚动的距离，确保内容不被工具栏覆盖
        const extraScrollPadding = 60; // 增加额外的底部空间，从40px改为60px
        
        // 立即滚动，确保内容完全可见
        container.scrollTop = container.scrollHeight + extraScrollPadding;
        
        // 设置多个延时滚动，以处理不同类型内容的加载时间差异
        const delays = [10, 50, 150, 300, 500, 800];  // 增加更多的延迟检查点，添加更短和更长的延迟
        delays.forEach(delay => {
            setTimeout(() => {
                // 再次检查是否应该滚动，以尊重用户可能的新滚动行为
                if (shouldAutoScroll(container)) {
                    container.scrollTop = container.scrollHeight + extraScrollPadding;
                }
            }, delay);
        });
        
        // 添加一个最终检查，处理可能延迟加载的内容（如图片等）
        setTimeout(() => {
            if (shouldAutoScroll(container) && 
                container.scrollHeight - container.scrollTop - container.clientHeight > 20) {
                container.scrollTop = container.scrollHeight + extraScrollPadding;
            }
        }, 1000);
    }
}

// 导出为全局函数
window.ensureScrollToBottom = ensureScrollToBottom;

/**
 * 处理流式响应，用于从服务器读取和处理SSE数据流
 * @param {Response} response - 从服务器获取的响应对象
 * @param {HTMLElement} messageDiv - 消息容器元素
 * @param {HTMLElement} messageContent - 消息内容元素
 * @param {Object} options - 配置选项
 * @param {number} options.messageIndex - 消息索引
 * @param {Object} options.md - Markdown渲染器对象
 * @param {HTMLElement} options.chatMessages - 聊天消息容器元素
 * @param {boolean} options.shouldScrollToBottom - 是否应该滚动到底部，默认为true
 * @returns {Promise<{assistantMessage: string, reasoningBox: Object}>} 返回助手消息内容和reasoningBox对象
 */
async function processStreamResponse(response, messageDiv, messageContent,accumulatedMessage,options = {}) {
    const { messageIndex, md, chatMessages,reasoningBox,toolBoxMap, shouldScrollToBottom = true } = options;
    console.log("accumulatedMessage:", accumulatedMessage);
    console.log("===== processStreamResponse开始 =====");
    console.log("接收到response对象:", response.status, response.statusText);
    console.log("messageIndex:", messageIndex);
    console.log("当前generationStopped状态:", window.generationStopped);
    console.log("当前window.isGenerating状态:", window.isGenerating);
    
    // 初始化文本位置计数器
    let textPosition = accumulatedMessage.length ? accumulatedMessage.length : 0;
    console.log("textPosition:", textPosition);
    const reader = response.body.getReader();
    console.log("获取reader,reader：", reader);
    console.log("当前currentReader值(赋值前):", currentReader);
    currentReader = reader;
    console.log("设置currentReader完成");
    const decoder = new TextDecoder();
    
    sendButton.disabled = false; // 在获取流之后接触禁用，允许用户关闭流。
    
    let assistantMessage = accumulatedMessage ? accumulatedMessage : '';
    // let reasoningBox = keepReasoningBox ? window.ReasoningBoxInstance : null;
    let toolResult = [];
    
    // // 工具框映射，用于跟踪每个工具调用的工具框实例
    // const toolBoxMap = new Map();
    
    // 获取当前选择的模型
    const selectedModel = document.getElementById('model-select').value;
    console.log("当前选择的模型:", selectedModel);
    
    // 检查是否为高性能推理模型（如o1, o3-mini）
    const isHighPerformanceReasoningModel = ['o1', 'o3-mini'].includes(selectedModel);
    console.log("是否为高性能推理模型:", isHighPerformanceReasoningModel);
    
    // 检测设备性能
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isLowPerformanceDevice = isMobileDevice || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    console.log("是否为移动设备:", isMobileDevice);
    console.log("是否为低性能设备:", isLowPerformanceDevice);
    
    // 用于节流UI更新的变量
    let lastUIUpdateTime = Date.now();
    let pendingReasoningContent = '';
    let pendingTextContent = '';
    
    // 根据设备和模型调整UI更新间隔
    const REASONING_UPDATE_INTERVAL = isHighPerformanceReasoningModel ? 500 : (isLowPerformanceDevice ? 300 : 200);
    const TEXT_UPDATE_INTERVAL = isLowPerformanceDevice ? 250 : (isHighPerformanceReasoningModel ? 200 : 150);
    const MAX_CONTENT_BUFFER = isLowPerformanceDevice ? 1000 : 2000;  // 在低性能设备上减小缓冲区
    
    console.log("思考内容UI更新最小间隔:", REASONING_UPDATE_INTERVAL);
    console.log("文本内容UI更新最小间隔:", TEXT_UPDATE_INTERVAL);
    console.log("最大内容缓冲区大小:", MAX_CONTENT_BUFFER);
    
    // 循环读取响应流
    console.log("准备进入读取流循环");
    let loopCounter = 0;
    while (true) {
        loopCounter++;
        console.log(`===== 循环迭代 #${loopCounter} =====`);
        try {
            // 检查是否已手动停止生成
            console.log("检查generationStopped:", window.generationStopped);
            if (window.generationStopped) {
                console.log("检测到generationStopped为true，准备中断流处理");
                // 重置标志
                window.generationStopped = false;
                console.log("重置generationStopped为false");
                // 如果存在reasoningBox，则保存到全局实例
                if (reasoningBox) {
                    console.log("保存reasoningBox到全局实例");
                    window.ReasoningBoxInstance = reasoningBox;
                }
                
                // 处理剩余的内容
                if (pendingTextContent) {
                    updateTextContent(messageContent, assistantMessage, md, chatMessages, shouldScrollToBottom);
                    pendingTextContent = '';
                }
                break;
            }
            
            console.log("准备调用reader.read()");
            const readStart = Date.now();
            const { value, done } = await reader.read();
            const readEnd = Date.now();
            console.log(`reader.read()完成，耗时: ${readEnd - readStart}ms, done:`, done);
            
            if (done) {
                console.log("检测到流结束信号(done=true)");
                // 如果有待处理的思考内容，最后一次更新UI
                if (pendingReasoningContent && reasoningBox) {
                    console.log("处理剩余的思考内容");
                    reasoningBox.appendContent(pendingReasoningContent);
                    pendingReasoningContent = '';
                }
                
                // 如果有待处理的文本内容，最后一次更新UI
                if (pendingTextContent) {
                    console.log("处理剩余的文本内容");
                    textPosition = updateTextContent(messageContent, assistantMessage, md, chatMessages, shouldScrollToBottom);
                    pendingTextContent = '';
                }
                
                // 只有在存在 reasoningBox 时才标记完成
                if (reasoningBox) {
                    console.log("标记reasoningBox完成");
                    //reasoningBox.markGenerationComplete();
                    
                    // 检查是否需要生成摘要
                    if (!reasoningBox.getSummary() && reasoningBox.getContent()) {
                        console.log("流结束后生成摘要");
                        const reasoningData = {
                            reasoning_content: reasoningBox.getContent(),
                            reasoning_summary: null
                        };
                        const summary = reasoningData.reasoning_content;
                        if (summary) {
                            console.log("设置摘要:", summary.substring(0, 30) + "...");
                            reasoningBox.setSummary(summary);
                        }
                    }
                }
                
                // 标记所有工具框为完成状态
                toolBoxMap.forEach(toolBox => {
                    if (toolBox) {
                        console.log(`标记工具框 ${toolBox.getToolName()} 完成`);
                        toolBox.updateProgress();
                    }
                });
                
                break;
            }
            
            console.log("解码数据块，大小:", value?.length || 0);
            const text = decoder.decode(value);
            const lines = text.split('\n');
            console.log("解析得到行数:", lines.length);
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        console.log("处理SSE数据行:", line.slice(0, 30) + "...");
                        const data = JSON.parse(line.slice(6));
                        console.log("data:", data);
                        
                        if (data.error) {
                            console.error('解析SSE数据出错:', data.error);
                            messageDiv.classList.add('error-message');
                            messageContent.innerHTML = md.render('发生错误，请重试\n'+data.error);
                            
                            // 添加重新生成按钮
                            const messageWrapper = messageDiv.querySelector('.message-wrapper');
                            const messageActions = messageWrapper.querySelector('.message-actions');
                            messageActions.innerHTML = '';
                            createRegenerateButton(messageIndex, messageActions, true);
                            
                            throw new Error(data.error);
                        }
                        
                        // 处理工具步骤响应
                        if (data.step_response) {
                            console.log("处理工具步骤响应:", data.step_response);
                            const stepResponse = data.step_response;
                            const toolCallId = stepResponse.tool_call_id;
                            const toolName = stepResponse.tool_name;
                            const displayText = stepResponse.display_text || '';
                            // 获取工具序号(如果有)
                            const toolIndex = stepResponse.tool_index !== undefined ? stepResponse.tool_index : toolBoxMap.size;
                            
                            // 检查是否已存在该工具的工具框
                            let toolBox = toolBoxMap.get(toolCallId);
                            if (!toolBox) {
                                console.log(`创建新的工具框，工具ID: ${toolCallId}, 工具名称: ${toolName}, 序号: ${toolIndex}`);
                                // 首次出现该工具，创建新的工具框
                                toolBox = new ToolBox(messageContent, md);
                                toolBox.setToolName(toolName);
                                toolBox.setToolCallId(toolCallId);
                                toolBox.setToolIndex(toolIndex);
                                
                                // 使用工具的显示顺序设置插入位置标记
                                if (textPosition > 0) {
                                    // 如果已经有文本内容，则在文本内容之后插入
                                    toolBox.setInsertPositionMark(textPosition + toolIndex + 1);
                                } else {
                                    // 没有文本内容时，使用工具序号作为排序依据
                                    toolBox.setInsertPositionMark(toolIndex);
                                }
                                
                                // 保存到工具框映射
                                toolBoxMap.set(toolCallId, toolBox);
                            }
                            
                            // 添加步骤数据
                            console.log(`向工具框添加步骤: ${displayText}`);
                            toolBox.addStep({
                                content: displayText,
                                status: 'running',
                                tool_index: toolIndex
                            });
                            
                            // 更新进度条
                            toolBox.updateProgress();
                        }
                        
                        // 处理工具最终响应
                        if (data.final_response) {
                            console.log("处理工具最终响应:", data.final_response);
                            const finalResponse = data.final_response;
                            const toolCallId = finalResponse.tool_call_id;
                            const toolName = finalResponse.tool_name;
                            const status = finalResponse.status || 'success';
                            const displayText = finalResponse.display_text || '';
                            const result = finalResponse.result || {};
                            // 获取工具序号(如果有)
                            const toolIndex = finalResponse.tool_index !== undefined ? finalResponse.tool_index : toolBoxMap.size;
                            
                            // 检查是否已存在该工具的工具框
                            let toolBox = toolBoxMap.get(toolCallId);
                            if (!toolBox) {
                                console.log(`创建新的工具框用于最终响应，工具ID: ${toolCallId}, 工具名称: ${toolName}, 序号: ${toolIndex}`);
                                // 直接创建新的工具框
                                toolBox = new ToolBox(messageContent, md);
                                toolBox.setToolName(toolName);
                                toolBox.setToolCallId(toolCallId);
                                toolBox.setToolIndex(toolIndex);
                                
                                // 使用工具的显示顺序设置插入位置标记
                                if (textPosition > 0) {
                                    // 如果已经有文本内容，则在文本内容之后插入
                                    toolBox.setInsertPositionMark(textPosition + toolIndex + 1);
                                } else {
                                    // 没有文本内容时，使用工具序号作为排序依据
                                    toolBox.setInsertPositionMark(toolIndex);
                                }
                                
                                // 保存到工具框映射
                                toolBoxMap.set(toolCallId, toolBox);
                            }
                            
                            // 设置最终结果
                            console.log(`设置工具框最终结果: ${displayText}, 状态: ${status}`);
                            toolBox.setResult({
                                content: displayText,
                                status: status,
                                data: result,
                                tool_index: toolIndex
                            });
                        }
                        
                        // 处理思考内容
                        if (data.reasoning_content) {
                            console.log("处理思考内容:", data.reasoning_content.slice(0, 30) + "...");
                            // 如果还没有创建 reasoningBox，创建一个
                            if (!reasoningBox) {
                                console.log("创建新的reasoningBox");
                                reasoningBox = new ReasoningBox(messageContent, md);
                                // 保存到全局变量，以便stopGeneration可以访问
                                window.ReasoningBoxInstance = reasoningBox;
                            }
                            
                            // 累积思考内容并节流UI更新
                            pendingReasoningContent += data.reasoning_content;
                            const now = Date.now();
                            
                            // 如果达到更新间隔，或者内容太多，则更新UI
                            if (now - lastUIUpdateTime >= REASONING_UPDATE_INTERVAL || 
                                pendingReasoningContent.length > MAX_CONTENT_BUFFER) {
                                console.log("更新思考内容UI，长度:", pendingReasoningContent.length);
                                reasoningBox.appendContent(pendingReasoningContent);
                                pendingReasoningContent = '';
                                lastUIUpdateTime = now;
                                
                                // 给UI线程一点时间更新
                                await new Promise(resolve => setTimeout(resolve, 0));
                            }
                        } 
                        // 处理等待推理标志
                        else if (data.waiting_reasoning) {
                            console.log("收到waiting_reasoning数据:", data);
                            // 如果收到waiting_reasoning为true，则表示模型正在思考，创建reasoningBox，提示用户等待
                            // 如果还没有创建 reasoningBox，创建一个
                            if (!reasoningBox) {
                                console.log("创建ReasoningBox实例");
                                reasoningBox = new ReasoningBox(messageContent, md);
                                // 开始计时
                                reasoningBox.startTimer();
                            }
                            reasoningBox.appendContent("模型正在思考，请稍等...");
                        }
                        // 处理正常内容
                        else if (data.content) {
                            console.log("处理内容:", data.content);
                            // 如果有 reasoningBox 且是第一次收到内容，标记思考完成
                            if (reasoningBox) {
                                console.log("标记思考完成，进入生成内容阶段");
                                
                                // 如果有待处理的思考内容，确保在标记完成前处理完
                                if (pendingReasoningContent) {
                                    console.log("处理剩余的思考内容");
                                    reasoningBox.appendContent(pendingReasoningContent);
                                    pendingReasoningContent = '';
                                }
                                
                                // reasoningBox.markGenerationComplete();
                                
                                // 检查是否有摘要，如果没有则尝试生成，后续这部分需要转移到handleMessageRequest中，等待自循环结束后再生成。
                                if (!reasoningBox.getSummary() && reasoningBox.getContent()) {
                                    console.log("生成摘要");
                                    const reasoningData = {
                                        reasoning_content: reasoningBox.getContent(),
                                        reasoning_summary: null
                                    };
                                    const summary = extractSummaryFromThinking(reasoningData);
                                    if (summary) {
                                        console.log("设置摘要:", summary.substring(0, 30) + "...");
                                        reasoningBox.setSummary(summary);
                                    }
                                }
                            }
                            
                            // 累积消息内容
                            assistantMessage += data.content;
                            pendingTextContent += data.content;
                            
                            // 节流UI更新 - 对所有模型都应用节流
                            const now = Date.now();
                            if (now - lastUIUpdateTime >= TEXT_UPDATE_INTERVAL || 
                                pendingTextContent.length > MAX_CONTENT_BUFFER) {
                                console.log("更新消息内容UI, 累积内容长度:", assistantMessage.length);
                                textPosition = updateTextContent(messageContent, assistantMessage, md, chatMessages, shouldScrollToBottom);
                                pendingTextContent = '';
                                lastUIUpdateTime = now;
                                
                                // 在内容更新后，确保工具框位置正确
                                toolBoxMap.forEach(toolBox => {
                                    if (toolBox) {
                                        console.log(`更新工具框 ${toolBox.getToolName()} 位置`);
                                        toolBox.updateToolBoxPosition();
                                    }
                                });
                                
                                // 给UI线程一点时间更新
                                await new Promise(resolve => setTimeout(resolve, 0));
                            }
                        }
                        
                        // 处理工具消息（添加到历史记录）
                        if (data.tool_messages && Array.isArray(data.tool_messages)) {
                            console.log("处理工具消息:", data.tool_messages.length);
                            
                            // 获取当前对话
                            // const currentConversation = conversations.find(c => c.id === currentConversationId);
                            // if (currentConversation) {
                                // 将工具消息添加到对话历史记录中（只在内存中添加，不立即保存）
                            data.tool_messages.forEach(toolMessage => {
                                console.log("添加工具消息到内存中:", toolMessage);
                                
                                // 确保工具消息结构完整
                                if (toolMessage.type === 'function' && toolMessage.function) {
                                    // 添加工具消息到当前对话
                                    toolResult.push({
                                        role: 'tool',
                                        type: toolMessage.type, 
                                        function: toolMessage.function,
                                        tool_call_id: toolMessage.tool_call_id,
                                        status: toolMessage.status,
                                        display_text: toolMessage.display_text,
                                        result: toolMessage.result,
                                        content: typeof toolMessage.display_text === 'string' ? toolMessage.display_text : 
                                                    (typeof toolMessage.result === 'object' ? JSON.stringify(toolMessage.result) : String(toolMessage.result))
                                    });
                                }
                            });
                                
                                // 不再在这里保存对话，而是等流程结束后与assistant消息一起保存
                                console.log("工具消息已添加到内存中，待流程结束后与assistant消息一起保存");
                            // } else {
                            //     console.error("处理工具消息失败: 未找到当前对话");
                            // }
                        }
                    } catch (error) {
                        console.error('解析SSE数据出错:', error, '原始数据:', line);
                        messageDiv.classList.add('error-message');
                        messageContent.innerHTML = md.render('发生错误，请重试\n'+error.message);

                        // 添加重新生成按钮
                        const messageWrapper = messageDiv.querySelector('.message-wrapper');
                        const messageActions = messageWrapper.querySelector('.message-actions');
                        messageActions.innerHTML = '';
                        createRegenerateButton(messageIndex, messageActions, true);

                        if (reasoningBox) {
                            reasoningBox.markGenerationComplete();
                        }
                        console.log("SSE数据解析错误，抛出异常");
                        throw error;
                    }
                }
            }
        } catch (error) {
            console.log("捕获到异常:", error.name, error.message);
            if (error.name === 'AbortError' || error.name === 'CancelError') {
                console.log("检测到流被取消:", error.name);
                if (reasoningBox) {
                    reasoningBox.markGenerationComplete();
                }
                console.log('Stream reading cancelled');
                
                // 不要添加错误状态，只是取消了生成
                messageDiv.classList.remove('regenerating');
                
                // 重新创建重新生成按钮
                const messageWrapper = messageDiv.querySelector('.message-wrapper');
                const messageActions = messageWrapper.querySelector('.message-actions');
                messageActions.innerHTML = '';
                createRegenerateButton(messageIndex, messageActions, true);
                
                console.log("处理流取消完成，退出循环");
                break;
            }
            console.error("未处理的异常，重新抛出:", error);
            throw error;
        }
    }
    
    console.log("===== processStreamResponse结束 =====");
    console.log("最终返回内容长度:", assistantMessage.length);
    console.log("reasoningBox:", reasoningBox ? "已创建" : "未创建");
    console.log("工具框数量:", toolBoxMap.size);
    console.log("toolResult:", toolResult);
    
    let is_valid = assistantMessage.trim() || (toolBoxMap && toolBoxMap.size > 0)
    return { assistantMessage, reasoningBox, toolBoxMap, toolResult, is_valid };
}

// 辅助函数：更新文本内容
function updateTextContent(messageContent, text, mdRenderer, chatMessagesContainer, shouldScroll) {
    // 创建或更新普通内容的容器
    let textContentDiv = messageContent.querySelector('.text-content');
    if (!textContentDiv) {
        console.log("创建文本内容容器");
        textContentDiv = document.createElement('div');
        textContentDiv.className = 'text-content';
        messageContent.appendChild(textContentDiv);
    }
    
    // 渲染内容
    textContentDiv.innerHTML = mdRenderer.render(text);
    initializeCodeBlocks(textContentDiv);
    
    // 更新textPosition值
    let textPosition = text.length;
    
    // 检查并处理图片加载完成后的滚动
    const images = textContentDiv.querySelectorAll('img');
    if (images.length > 0) {
        console.log("发现图片:", images.length);
        images.forEach(img => {
            if (!img.complete) {
                img.onload = function() {
                    console.log("图片加载完成，滚动到底部");
                    ensureScrollToBottom(chatMessagesContainer);
                };
            }
        });
    }   
    
    // 根据选项决定如何滚动
    if (shouldScroll) {
        console.log("强制滚动到底部");
        ensureScrollToBottom(chatMessagesContainer);
    } else if (shouldAutoScroll(chatMessagesContainer)) {
        console.log("自动滚动到内容可见");
        textContentDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    
    // 返回文本位置
    return textPosition;
}

// 创建编辑按钮
function createEditButton(messageIndex, messageActions) {
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = '✏️ 编辑';
    editBtn.onclick = () => {
        const currentConversation = conversations.find(c => c.id === currentConversationId);
        if (currentConversation && currentConversation.messages[messageIndex]) {
            editUserMessage(messageIndex, currentConversation.messages[messageIndex].content);
        }
    };
    messageActions.appendChild(editBtn);
}

/**
 * 处理消息请求的公共函数
 * @param {Object} requestData - 请求数据
 * @param {Element} messageDiv - 消息DOM元素
 * @param {Element} messageContent - 消息内容DOM元素
 * @param {Object} options - 额外选项
 * @param {boolean} options.isRegeneration - 是否是重新生成
 * @param {boolean} options.isErrorRegeneration - 是否是错误消息重新生成
 * @param {string} options.messageIndex - 消息索引
 * @param {Object} options.md - Markdown渲染器
 * @param {Element} options.chatMessages - 聊天消息容器
 * @param {boolean} options.shouldScrollToBottom - 是否自动滚动到底部
 * @param {function} options.afterProcessCallback - 流处理完成后的回调函数
 * @returns {Promise<Object>} - 返回流处理结果
 */
async function handleMessageRequest(requestData, messageDiv, messageContent, options = {}) {
    const {
        isRegeneration = false,
        isErrorRegeneration = false,
        messageIndex,
        md,
        chatMessages,
        shouldScrollToBottom = true,
        afterProcessCallback = null
    } = options;
    let reasoningBox = new ReasoningBox(messageContent,md)
    let toolBoxMap = new Map()
    let accumulatedMessage = '';
    let messageStatus = 0;
    let processResult = null;
    try {
        do{
            console.log(`[${new Date().toISOString()}] 发送请求:`, {
                messages: requestData.messages,
                conversation_id: requestData.conversation_id,
                model_id: requestData.model_id,
                temperature: requestData.temperature,
                max_tokens: requestData.max_tokens,
            });
    
            // 发送请求
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            // 处理流响应
            const processOptions = {
                messageIndex,
                md,
                chatMessages,
                reasoningBox,
                toolBoxMap,
                shouldScrollToBottom
            };
            
            processResult = await processStreamResponse(
                response, 
                messageDiv, 
                messageContent, 
                accumulatedMessage,
                processOptions
            );
    
            // 更新累积的消息内容，保存到下一次循环
            accumulatedMessage = processResult.assistantMessage;
    
            // // 保存会话
            // if (currentConversationId) {
            //     await saveConversation(currentConversationId, 'update');
            // }
    
            // 如果存在回调函数，执行回调
            if (afterProcessCallback && typeof afterProcessCallback === 'function') {
                await afterProcessCallback(processResult,messageStatus);
            }
            messageStatus = 1
            
            // 更新messages字段，确保包含最新的消息内容
            if (processResult.toolResult.length > 0) {
                // 查找最后一条助手消息的索引
                let lastAssistantIndex = -1;
                for (let i = messages.length - 1; i >= 0; i--) {
                    if (messages[i].role === 'assistant') {
                        lastAssistantIndex = i;
                        break;
                    }
                }
                
                // 更新助手消息内容并添加工具结果
                if (lastAssistantIndex !== -1) {
                    // 更新助手消息的内容
                    messages[lastAssistantIndex].content = processResult.assistantMessage;
                    
                    // 确保tool_results字段存在
                    if (!messages[lastAssistantIndex].tool_results) {
                        messages[lastAssistantIndex].tool_results = [];
                    }
                    
                    // 添加新的工具结果
                    messages[lastAssistantIndex].tool_results = 
                        messages[lastAssistantIndex].tool_results.concat(processResult.toolResult);
                } else {
                    // 如果找不到助手消息，创建一个新的带有工具结果的助手消息
                    const assistantMessage = {
                        role: 'assistant',
                        content: processResult.assistantMessage,
                        tool_results: processResult.toolResult
                    };
                    
                    // 添加到messages数组
                    messages.push(assistantMessage);
                }
                
                // 重要：将messages引用赋值给requestData.messages，确保它们始终是同一个对象
                requestData.messages = messages;
                
                console.log("更新后的messages:", messages.length, "第一条消息:", messages[0].role);
            }
            
        } while (processResult.toolResult.length > 0);

        messageStatus = -1;
        await afterProcessCallback(processResult,messageStatus);
        // 流处理完成后，清除全局ReasoningBoxInstance
        window.ReasoningBoxInstance = null;
        // 标志reasoningBox结束，生成摘要
        if (reasoningBox) {
            reasoningBox.markGenerationComplete();
            const reasoningData = {
                reasoning_content: reasoningBox.getContent(),
                reasoning_summary: null
            };
            const summary = extractSummaryFromThinking(reasoningData);
            if (summary) {
                reasoningBox.setSummary(summary);
            }
        }
        
        
        return processResult;
    } catch (error) {
        console.error('请求处理出错:', error);
        
        // 设置错误状态
        messageDiv.classList.add('error-message');
        messageDiv.classList.remove('regenerating');
        messageContent.innerHTML = md.render('发生错误，请重试\n' + error.message);
        
        // 添加重新生成按钮
        const messageWrapper = messageDiv.querySelector('.message-wrapper');
        const messageActions = messageWrapper.querySelector('.message-actions');
        messageActions.innerHTML = '';
        createRegenerateButton(messageIndex, messageActions, true);
        
        throw error;
    } finally {
        // 清理状态
        if (currentReader) {
            try {
                await currentReader.cancel();
            } catch (e) {
                console.log('Error cancelling stream:', e);
            }
            currentReader = null;
        }
    }
}