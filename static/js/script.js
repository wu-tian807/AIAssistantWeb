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
const md = initMarkdownit();
// 存储聊天消息历史
let messages = [];
// 当前的流式响应对象
let currentReader = null;
// 添加全局标志，用于表示是否手动停止生成
window.generationStopped = false;

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
    sendButton.disabled = !canSendMessage();
});

// 创建 MutationObserver 监听预览框的变化
const previewObserver = new MutationObserver(() => {
    sendButton.disabled = !canSendMessage();
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
            console.log("找到正在生成的消息，移除regenerating标记");
            // 移除regenerating标记
            regeneratingMessage.classList.remove('regenerating');
            
            // 重新添加重新生成按钮
            const messageActions = regeneratingMessage.querySelector('.message-actions');
            if (messageActions) {
                const messageIndex = regeneratingMessage.getAttribute('data-message-index');
                if (messageIndex) {
                    console.log("重新添加重新生成按钮，messageIndex:", messageIndex);
                    messageActions.innerHTML = '';
                    createRegenerateButton(parseInt(messageIndex), messageActions, false);
                }
            }
        } else {
            console.log("未找到正在生成的消息");
        }
        
        console.log("停止生成");
        // 重置生成状态
        console.log("重置window.isGenerating为false");
        window.isGenerating = false;
        console.log("重置generationStopped为false");
        window.generationStopped = false;
        
        console.log("===== stopGeneration函数执行完毕 =====");
        console.log("最终状态: isGenerating =", window.isGenerating, 
                    ", generationStopped =", generationStopped, 
                    ", currentReader =", currentReader);
    } else {
        console.log("window.isGenerating为false，不执行停止操作");
        console.log("===== stopGeneration函数执行完毕（无操作） =====");
    }
}



// 改进滚动检测和控制
let userScrolling = false;
let lastScrollTop = 0;
let scrollTimeout = null;
// 添加内容生成状态标志
window.isGenerating = false;

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
        }, 300);
    });
});

// 改进的shouldAutoScroll函数
window.shouldAutoScroll = function(container) {
    // 检查是否已经滚动到接近底部（距离底部100px以内）
    const scrollPosition = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = scrollPosition < 100;
    
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
    chatMessages.scrollTop = chatMessages.scrollHeight;
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
        
        // 隐藏重新生成按钮
        regenerateBtn.style.display = 'none';
        
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
                regenerateBtn.style.display = 'block';
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
    const messageDiv = document.createElement('div');
    // 先设置基本类名
    messageDiv.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;
    // 如果发生错误，则添加错误样式
    if(error){
        messageDiv.classList.add('error-message');
    }
    if(!isUser){
        // 从消息历史中获取模型图标信息
        let iconInfo = modelInfo;
        if (!iconInfo && messageIndex !== null) {
            const currentConversation = conversations.find(c => c.id === currentConversationId);
            if (currentConversation && currentConversation.messages[messageIndex]) {
                const message = currentConversation.messages[messageIndex];
                iconInfo = {
                    icon: message.modelIcon,
                    id: message.modelId
                };
            }
        }
        
        // 确保iconInfo是一个对象，包含icon属性
        let iconData = (iconInfo && iconInfo.icon) ? iconInfo.icon : iconInfo;
        
        const iconRenderer = new IconRenderer(iconData);
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'model-icon-wrapper';
        iconWrapper.setAttribute('data-model-icon', iconData);
        iconWrapper.appendChild(iconRenderer.modelIcon);
        messageDiv.appendChild(iconWrapper);
    }
    
    // 如果没有提供消息索引，则使用当前消息数组的长度
    if (messageIndex === null) {
        const currentConversation = conversations.find(c => c.id === currentConversationId);
        if (currentConversation) {
            messageIndex = currentConversation.messages.length - 1;
        }
    }
    
    messageDiv.setAttribute('data-message-index', messageIndex);

    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper';

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    // 如果是助手消息，先检查是否有思考内容
    if (!isUser) {
        const message = currentConversationId && conversations.find(c => c.id === currentConversationId)?.messages[messageIndex];
        if (message) {
            // 获取当前版本或直接使用消息的思考内容
            const reasoningData = message.versions && message.versions[message.currentVersion] ? 
                message.versions[message.currentVersion] : 
                message;
            
            // 直接检查思考内容是否存在
            if (reasoningData.reasoning_content) {
                // 使用 ReasoningBox 类创建思考框
                const reasoningBox = new ReasoningBox(messageContent, md);
                
                // 从序列化数据恢复
                reasoningBox.loadFromSerializedData({
                    reasoning_content: reasoningData.reasoning_content,
                    reasoning_summary: reasoningData.reasoning_summary,
                    reasoning_time: reasoningData.thinking_time
                });
                
                // 确保思考框可见
                reasoningBox.show();
            }
        }
    }
    
    // 创建文本内容容器
    const textContent = document.createElement('div');
    textContent.className = 'text-content';
    if (isUser) {
        textContent.textContent = content;
    } else {
        textContent.innerHTML = md.render(content);
        initializeCodeBlocks(textContent);  // 使用initializeCodeBlocks函数替代applyCodeHighlight函数
    }
    messageContent.appendChild(textContent);
    
    const messageActions = document.createElement('div');
    messageActions.className = 'message-actions';
    
    if (isUser) {
        // 添加编辑按钮
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
    } else {
        // 清空messageActions，确保按钮顺序正确
        messageActions.innerHTML = '';
        
        // 添加重新生成按钮（仅在错误时或非重新生成过程中添加）
        if (error || !messageDiv.closest('.regenerating')) {
            createRegenerateButton(messageIndex, messageActions, error);
        }
        
        // 如果存在多个版本，添加版本控制
        const message = currentConversationId && conversations.find(c => c.id === currentConversationId)?.messages[messageIndex];
        if (message?.versions?.length > 1) {
            createVersionControl(messageIndex, messageActions, message);
        }
    }
    
    messageWrapper.appendChild(messageContent);
    messageWrapper.appendChild(messageActions);

    // 处理附件
    if (attachments && attachments.length > 0) {
        const attachmentsContainer = document.createElement('div');
        attachmentsContainer.className = 'message-attachments-container';
        
        const attachmentRenderer = new AttachmentRenderer();
        const renderPromises = attachments.map(async attachment => {
            try {
                const renderedElement = await attachmentRenderer.render({
                    type: attachment.type || 'image',
                    base64_id: attachment.base64_id,
                    filename: attachment.fileName,
                    file_path: attachment.file_path,
                    mime_type: attachment.mime_type,
                    disableDelete: true,
                    duration: attachment.duration,
                    thumbnail_base64_id: attachment.thumbnail_base64_id
                });
                
                if (renderedElement) {
                    attachmentsContainer.appendChild(renderedElement);
                }
            } catch (error) {
                console.error('渲染附件失败:', error);
                const errorElement = document.createElement('div');
                errorElement.className = 'attachment-error';
                errorElement.textContent = '附件加载失败';
                attachmentsContainer.appendChild(errorElement);
            }
        });
        
        Promise.all(renderPromises).then(() => {
            if (attachmentsContainer.children.length > 0) {
                // 如果是用户消息，将附件容器插入到消息内容之前
                if (isUser) {
                    messageDiv.insertBefore(attachmentsContainer, messageWrapper);
                } else {
                    // 如果是助手消息，将附件容器添加到消息内容之后
                    messageDiv.appendChild(attachmentsContainer);
                }
            }
        });
    }

    // 根据消息类型调整添加顺序
    if (isUser) {
        messageDiv.appendChild(messageWrapper);
    } else {
        messageDiv.appendChild(messageWrapper);
    }

    // 获取消息容器
    const chatMessages = document.getElementById('chat-messages');
    
    // 添加到消息容器
    chatMessages.appendChild(messageDiv);
    
    // 使用增强的滚动函数确保滚动到底部且内容完全可见
    ensureScrollToBottom(chatMessages);
    
    // 对于用户消息或强制滚动的情况，添加一个延迟滚动以确保内容完全加载后可见
    if (isUser || window.isGenerating) {
        setTimeout(() => {
            ensureScrollToBottom(chatMessages);
        }, 100);
    }
    
    // 在所有消息完成渲染后，如果是机器人回复结束，重置生成状态
    if (!isUser && !messageDiv.classList.contains('loading')) {
        // 消息处理完成，重置生成状态
        window.isGenerating = false;
    }
}

// 在文件开头添加新的变量
let conversations = [];
export let currentConversationId = null;

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

    try {
        console.log('Saving conversation with settings:', {
            temperature: modelSettings.temperature,
            max_tokens: maxTokens,
            model_id: selectedModel
        });
        
        const response = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                conversation: conversation,
                operation: operation,
                temperature: modelSettings.temperature,
                max_tokens: maxTokens,
                model_id: selectedModel  
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
                    // 处理版本数据
                    if (message.versions && message.versions.length > 0) {
                        // 确保每个版本都有subsequentMessages字段
                        message.versions.forEach((version, versionIndex) => {
                            if (!version.subsequentMessages) {
                                version.subsequentMessages = [];
                                
                                // 如果是当前版本，保存之后的消息作为后续消息
                                if (versionIndex === message.currentVersion) {
                                    version.subsequentMessages = conversation.messages.slice(index + 1);
                                }
                            }
                        });
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
            temperature: conversation.temperature || 0.7
        };
        
        console.log('Applying settings:', settings);
        window.modelSettingRenderer.setSettings(settings);
    }
    
    clearChatMessages();
    messages = [
        {"role": "system", "content": conversation.systemPrompt || default_system_prompt},
        ...conversation.messages
    ];

    // 渲染消息
    conversation.messages.forEach((msg, index) => {
        if (msg.role === 'assistant' && msg.versions && msg.versions[msg.currentVersion]) {
            const currentVersion = msg.versions[msg.currentVersion];
            appendMessage(msg.content, false, index, msg.attachments, currentVersion.modelIcon);
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
    },
    onUploadSuccess: (attachment) => {
        console.log('文件上传成功，添加到 imageUploader:', attachment);
        // 将上传的附件添加到 imageUploader 中
        imageUploader.attachments.add(attachment);
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

        const selectedModel = modelSelect.value;
        if (!selectedModel) {
            alert('请选择一个模型');
            return;
        }

        // 确保有当前对话
        if (!currentConversationId) {
            await createNewConversation();
        }

        // 检查是否被停止
        // if (window.generationStopped) {
        //     window.isGenerating = false;
        //     userInput.disabled = false;
        //     return;
        // }

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
        const messagesWithThinking = messages.map(msg => {
            // 只处理助手消息
            if (msg.role === 'assistant') {
                // 获取对应的对话对象
                const messageIndex = currentConversation.messages.findIndex(m => m.content === msg.content && m.role === 'assistant');
                if (messageIndex !== -1) {
                    const message = currentConversation.messages[messageIndex];
                    // 检查是否有思考内容
                    const reasoningData = message.versions && message.versions[message.currentVersion] ? 
                        message.versions[message.currentVersion] : 
                        message;
                    
                    if (reasoningData.reasoning_content) {
                        // 获取思考摘要
                        const summary = extractSummaryFromThinking(reasoningData);
                        if (summary) {
                            // 添加思考摘要，使用 <think></think> 标记包裹
                            return {
                                ...msg,
                                content: msg.content + '\n<think>' + summary + '</think>'
                            };
                        }
                    }
                }
            }
            return msg;
        });
        
        // 立即保存用户消息到数据库
        await saveConversation(currentConversation.id, 'update');
        
        // 如果是第一条消息，生成对话标题
        if (currentConversation.messages.length === 1) {
            currentConversation.title = content.slice(0, 20) + (content.length > 20 ? '...' : '');
            renderConversationsList();
            generateTitle(content);
        }

        // 清空输入框并更新按钮状态
        userInput.value = '';
        clearAttachmentPreview();
        sendButton.textContent = '停止';
        sendButton.classList.add('stop');
        sendButton.disabled = false; // 确保停止按钮始终可用
        userInput.disabled = true;

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

        // 创建思考框元素
        //const reasoningBox = new ReasoningBox(messageContent, md);
        
        const messageActions = document.createElement('div');
        messageActions.className = 'message-actions';
        
        // 移除这行代码，不要在生成过程中添加重新生成按钮
        // createRegenerateButton(messageIndex, messageActions, false);
        
        messageWrapper.appendChild(messageContent);
        messageWrapper.appendChild(messageActions);
        messageDiv.appendChild(messageWrapper);
        chatMessages.appendChild(messageDiv);
        // 重试循环
        for (let attempt = 0; attempt < retryCount; attempt++) {
            try {
                console.log(`[${new Date().toISOString()}] 尝试发送消息 (${attempt + 1}/${retryCount}):`, {
                    conversation_id: currentConversationId,
                    model_id: selectedModel,
                    temperature: temperature,
                    max_tokens: max_tokens,
                    networkType: navigator.connection?.type,
                    networkSpeed: navigator.connection?.downlink
                });

                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        messages: messagesWithThinking, // 使用包含思考内容的消息
                        conversation_id: currentConversationId,
                        model_id: selectedModel,
                        temperature: temperature,
                        max_tokens: max_tokens
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                // 使用公共函数处理流响应
                const { assistantMessage, reasoningBox } = await processStreamResponse(
                    response, 
                    messageDiv, 
                    messageContent, 
                    {
                        messageIndex,
                        md,
                        chatMessages,
                        shouldScrollToBottom: true
                    }
                );

                // 成功接收到内容，保存到消息历史
                if (assistantMessage.trim()) {
                    const thinking_time = reasoningBox ? reasoningBox.getThinkingTime() : 0;
                    const reasoning_summary = reasoningBox ? reasoningBox.getSummary() : null;
                    
                    currentConversation.messages.push({ 
                        role: "assistant", 
                        content: assistantMessage,
                        reasoning_content: reasoningBox ? reasoningBox.getContent() : null,
                        reasoning_summary: reasoning_summary, // 保存摘要
                        thinking_time: thinking_time,  // 保存思考时间
                        modelIcon: modelIcon,
                        modelId: selectedModel,
                        versions: [{
                            content: assistantMessage,
                            reasoning_content: reasoningBox ? reasoningBox.getContent() : null,
                            reasoning_summary: reasoning_summary, // 保存摘要到版本历史
                            thinking_time: thinking_time,  // 保存思考时间到版本历史
                            attachments: [],
                            subsequentMessages: [],
                            modelIcon: modelIcon,
                            modelId: selectedModel
                        }],
                        currentVersion: 0
                    });
                    
                    // 添加重新生成按钮和版本控制
                    const messageWrapper = messageDiv.querySelector('.message-wrapper');
                    const messageActions = messageWrapper.querySelector('.message-actions');
                    createRegenerateButton(messageIndex, messageActions, false);
                    
                    // 保存对话
                    await saveConversation(currentConversation.id, 'update');
                }
                
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
        sendButton.disabled = true;
        userInput.disabled = true;
    }

    // 设置内容生成状态为true
    window.isGenerating = true;
    // 重置生成停止标志
    window.generationStopped = false;
    
    try {
        console.log("进入重新生成消息的主体");
        // 获取当前消息元素
        const messageDiv = chatMessages.children[messageIndex];
        if (!messageDiv) {
            console.error('找不到消息元素');
            return;
        }
        
        // 立即移除错误状态并添加regenerating标记
        console.log("移除错误状态并添加regenerating标记");
        messageDiv.classList.remove('error-message');
        messageDiv.classList.add('regenerating');
        
        // 找到重新生成按钮并隐藏
        const regenerateBtn = messageDiv.querySelector('.regenerate-btn');
        if (regenerateBtn) {
            regenerateBtn.style.display = 'none';
        }
        
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
        
        const message = currentConversation.messages[messageIndex];
        if (!message || message.role !== 'assistant') {
            showError('无法重新生成非助手消息');
            // 移除regenerating标记
            messageDiv.classList.remove('regenerating');
            // 恢复重新生成按钮
            if (regenerateBtn) {
                regenerateBtn.disabled = false;
                regenerateBtn.style.display = 'block';
            }
            return;
        }
        
        // 保存后续消息
        const subsequentMessages = currentConversation.messages.slice(messageIndex + 1);
        
        // 初始化versions数组(如果不存在)，现在包含完整的消息对象
        if (!message.versions) {
            message.versions = [{
                content: message.content,
                attachments: message.attachments || [],
                subsequentMessages: subsequentMessages,  // 保存后续消息
                modelIcon: message.modelIcon,  // 保存原始版本的模型信息
                modelId: message.modelId
            }];
            message.currentVersion = 0;
        } else {
            // 确保当前版本保存了后续消息
            if (message.versions[message.currentVersion]) {
                message.versions[message.currentVersion].subsequentMessages = subsequentMessages;
            }
        }
        
        // 先清除UI中的后续消息
        while (chatMessages.children.length > messageIndex + 1) {
            chatMessages.removeChild(chatMessages.lastChild);
        }
        
        // 获取到指定消息之前的所有消息，包括附件
        const messagesUntilIndex = currentConversation.messages.slice(0, messageIndex);
        console.log('Messages until index:', messagesUntilIndex); // 调试日志
        
        // 设置messages数组用于API请求
        messages = [
            {"role": "system", "content": currentConversation.systemPrompt || default_system_prompt},
            ...messagesUntilIndex
        ];
        
        // 禁用发送按钮，显示停止按钮
        sendButton.textContent = '停止';
        sendButton.classList.add('stop');
        sendButton.disabled = false;  // 确保停止按钮可点击
        userInput.disabled = true;  // 禁用输入框
        
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

            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    messages: messages,
                    conversation_id: currentConversationId,
                    model_id: selectedModel,
                    temperature: modelSettings.temperature,
                    max_tokens: modelSettings.current_output_tokens
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 使用公共函数处理流响应
            const { assistantMessage, reasoningBox } = await processStreamResponse(
                response, 
                messageDiv, 
                messageContent, 
                {
                    messageIndex,
                    md,
                    chatMessages,
                    shouldScrollToBottom: false // 使用shouldAutoScroll决定是否滚动
                }
            );
            
            if (assistantMessage.trim()) {
                // 获取当前消息对象，如果不存在则创建一个新的
                let message = currentConversation.messages[messageIndex];
                if (!message) {
                    message = {
                        role: 'assistant',
                        content: '',
                        versions: []
                    };
                    currentConversation.messages[messageIndex] = message;
                }
                
                // 确保消息角色是assistant
                message.role = 'assistant';
                
                // 创建新版本
                const newVersion = {
                    content: assistantMessage,
                    reasoning_content: reasoningBox ? reasoningBox.getContent() : null,
                    reasoning_summary: reasoningBox ? reasoningBox.getSummary() : null, // 保存摘要到版本历史
                    thinking_time: reasoningBox ? reasoningBox.getThinkingTime() : null,  // 保存思考时间到版本历史
                    attachments: [],
                    subsequentMessages: [], // 新版本不应该有后续消息，因为重新生成时已经清空了后续消息
                    modelIcon: modelIcon, // 使用当前选择的模型图标
                    modelId: selectedModel // 使用当前选择的模型ID
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
                
                // 保存对话
                await saveConversation(currentConversation.id, 'update');
            }
            
            // 清理状态
            if (currentReader) {
                currentReader = null;
            }
            // userInput.disabled = false;
            // console.log("发送按钮触发2");
            // sendButton.textContent = '发送';
            // sendButton.classList.remove('stop');
            // if(!canSendMessage()){
            //     sendButton.disabled = true;
            // }else{
            //     sendButton.disabled = false;
            // }
            
            // 移除regenerating标记
            messageDiv.classList.remove('regenerating');
            
        } catch (error) {
            // 清理状态
            if (currentReader) {
                await currentReader.cancel();
                currentReader = null;
            }
            //userInput.disabled = false;
            // console.log("发送按钮触发3");
            // sendButton.textContent = '发送';
            // sendButton.classList.remove('stop');
            // if(!canSendMessage()){
            //     sendButton.disabled = true;
            // }else{
            //     sendButton.disabled = false;
            // }
            
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
                    type: attachment.type || (attachment.mime_type?.startsWith('video/') ? 'video' : 'image'),
                    base64_id: attachment.base64_id,
                    fileName: attachment.fileName,
                    mime_type: attachment.mime_type,
                    file_path: attachment.file_path,
                    // 视频特有属性
                    duration: attachment.duration,
                    thumbnail: attachment.thumbnail,
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
                
                return {
                    type: attachment.type || (attachment.getMimeType?.()?.startsWith('video/') ? 'video' : 'image'),
                    base64_id: attachment.getBase64Id?.(),
                    fileName: attachment.getFileName(),
                    mime_type: attachment.getMimeType(),
                    file_path: attachment.getFilePath(),
                    duration: attachment.getDuration?.() || undefined,
                    thumbnail: attachment.getThumbnail?.() || undefined
                };
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
                        const renderedElement = await attachmentRenderer.render({
                            type: attachment.type || 'image',
                            base64_id: attachment.base64_id,
                            filename: attachment.fileName,
                            file_path: attachment.file_path,
                            mime_type: attachment.mime_type,
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
    // 如果正在生成内容，不允许切换版本
    if (window.isGenerating || currentReader) {
        console.log('正在生成内容，无法切换版本');
        return;
    }
    
    const messageDiv = document.querySelector(`[data-message-index="${messageIndex}"]`);
    if (!messageDiv) return;

    const messageContent = messageDiv.querySelector('.message-content');
    if (!messageContent) return;
    
    try {
        // 添加加载状态
        messageDiv.classList.add('switching-version');
        
        // 清除原有的思考框
        const existingReasoningBox = messageContent.querySelector('.reasoning-box');
        if (existingReasoningBox) {
            messageContent.removeChild(existingReasoningBox);
        }

        // 获取当前消息
        const currentConversation = conversations.find(c => c.id === currentConversationId);
        if (!currentConversation) return;

        const message = currentConversation.messages[messageIndex];
        if (!message) return;

        // 获取当前版本和新版本信息
        const currentVersionIndex = message.currentVersion;
        const currentVersion = message.versions[currentVersionIndex];
        const newVersionData = message.versions[newVersion];
        if (!newVersionData) return;

        // 始终保存当前的后续消息到当前版本
        currentVersion.subsequentMessages = currentConversation.messages.slice(messageIndex + 1);
        
        // 显示调试信息
        console.log(`从版本 ${currentVersionIndex} 切换到版本 ${newVersion}`);
        console.log('当前版本后续消息:', currentVersion.subsequentMessages);
        console.log('新版本后续消息:', newVersionData.subsequentMessages);

        // 更新版本
        message.currentVersion = newVersion;
        const version = message.versions[newVersion];

        // 更新模型图标
        if (version.modelIcon) {
            const iconWrapper = messageDiv.querySelector('.model-icon-wrapper');
            if (iconWrapper) {
                // 更新 data-model-icon 属性
                iconWrapper.setAttribute('data-model-icon', version.modelIcon);
                
                // 清空现有图标
                iconWrapper.innerHTML = '';
                
                // 创建新图标
                const iconRenderer = new IconRenderer(version.modelIcon);
                iconWrapper.appendChild(iconRenderer.modelIcon);
            }
        }
        
        // 更新消息模型ID
        message.modelIcon = version.modelIcon;
        message.modelId = version.modelId;

        // 清空现有内容
        messageContent.innerHTML = '';

        // 如果有思考内容，创建新的思考框
        if (version.reasoning_content) {
            // 检查该消息使用的模型是否支持推理
            const modelId = version.modelId;
            // 只有当模型支持推理时才创建推理框
            if (modelId && isReasonerModel(modelId)) {
                const reasoningBox = new ReasoningBox(messageContent, md);
                // 使用loadFromSerializedData加载数据
                reasoningBox.loadFromSerializedData({
                    reasoning_content: version.reasoning_content,
                    reasoning_summary: version.reasoning_summary,
                    reasoning_time: version.thinking_time
                });
            }
        }

        // 创建文本内容容器
        const textContent = document.createElement('div');
        textContent.className = 'text-content';
        textContent.innerHTML = md.render(version.content);
        messageContent.appendChild(textContent);

        // 应用代码高亮
        initializeCodeBlocks(textContent);

        // 如果在底部，自动滚动
        const chatMessages = document.getElementById('chat-messages');
        if (shouldAutoScroll(chatMessages)) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        // 更新附件
        const attachmentsContainer = messageDiv.querySelector('.message-attachments-container');
        if (attachmentsContainer) {
            attachmentsContainer.innerHTML = '';
            if (version.attachments && version.attachments.length > 0) {
                attachmentsContainer.style.display = 'flex';
                version.attachments.forEach(attachment => {
                    const attachmentElement = createAttachmentElement(attachment);
                    attachmentsContainer.appendChild(attachmentElement);
                });
            } else {
                attachmentsContainer.style.display = 'none';
            }
        }

        // 更新版本控制
        const messageActions = messageDiv.querySelector('.message-actions');
        if (messageActions) {
            messageActions.innerHTML = '';
            // 先添加重新生成按钮
            createRegenerateButton(messageIndex, messageActions);
            // 再添加版本控制
            if (message.versions.length > 1) {
                createVersionControl(messageIndex, messageActions, message);
            }
        }
        
        // 恢复后续消息
        // 1. 清除当前对话中从这条消息之后的所有消息
        currentConversation.messages = currentConversation.messages.slice(0, messageIndex + 1);
        
        // 2. 清除UI中从这条消息之后的所有消息
        while (chatMessages.children.length > messageIndex + 1) {
            chatMessages.removeChild(chatMessages.lastChild);
        }
        
        // 3. 如果当前版本有存储的后续消息，恢复它们
        if (version.subsequentMessages && version.subsequentMessages.length > 0) {
            // 恢复到数据模型中
            currentConversation.messages = [
                ...currentConversation.messages,
                ...version.subsequentMessages
            ];
            
            // 恢复到UI中
            version.subsequentMessages.forEach((msg, idx) => {
                const totalIndex = messageIndex + 1 + idx;
                appendMessage(
                    msg.content,
                    msg.role === 'user',
                    totalIndex,
                    msg.attachments || [],
                    msg.role === 'assistant' ? { icon: msg.modelIcon, id: msg.modelId } : null,
                    msg.error || false
                );
            });
        }
        
        // 保存对话
        await saveConversation(currentConversation.id, 'update');
    } catch (error) {
        console.error('切换版本失败:', error);
        showError('切换版本失败: ' + error.message);
    } finally {
        // 移除加载状态
        messageDiv.classList.remove('switching-version');
    }
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
        sendButton.disabled = true;
        userInput.disabled = true;
    }

    // 设置内容生成状态为true
    window.isGenerating = true;
    
    try {
        // 获取当前消息元素
        const messageDiv = chatMessages.children[messageIndex];
        if (!messageDiv) {
            console.error('找不到消息元素');
            return;
        }
        
        // 立即移除错误状态并添加regenerating标记
        messageDiv.classList.remove('error-message');
        messageDiv.classList.add('regenerating');
        
        // 找到重新生成按钮并隐藏
        const regenerateBtn = messageDiv.querySelector('.regenerate-btn');
        if (regenerateBtn) {
            regenerateBtn.style.display = 'none';
        }
        
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
        
        // 确保我们只使用到用户的最后一条消息
        // 如果 messageIndex 大于实际消息数量，说明这是自动添加的错误消息
        // 这种情况下，我们应该使用到最后一条用户消息为止的所有消息
        const actualMessages = currentConversation.messages;
        const messagesUntilIndex = actualMessages;
        console.log('Messages until index:', messagesUntilIndex); // 调试日志
        
        // 设置messages数组用于API请求
        messages = [
            {"role": "system", "content": currentConversation.systemPrompt || default_system_prompt},
            ...messagesUntilIndex
        ];
        
        // 禁用发送按钮，显示停止按钮
        sendButton.textContent = '停止';
        sendButton.classList.add('stop');
        sendButton.disabled = false;  // 确保停止按钮可点击
        userInput.disabled = true;  // 禁用输入框
        
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

            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    messages: messages,
                    conversation_id: currentConversationId,
                    model_id: selectedModel,
                    temperature: modelSettings.temperature,
                    max_tokens: modelSettings.current_output_tokens
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 使用公共函数处理流响应
            const { assistantMessage, reasoningBox } = await processStreamResponse(
                response, 
                messageDiv, 
                messageContent, 
                {
                    messageIndex,
                    md,
                    chatMessages,
                    shouldScrollToBottom: false // 使用shouldAutoScroll决定是否滚动
                }
            );
            
            if (assistantMessage.trim()) {
                // 获取当前消息对象，如果不存在则创建一个新的
                let message = currentConversation.messages[messageIndex];
                if (!message) {
                    message = {
                        role: 'assistant',
                        content: '',
                        versions: []
                    };
                    currentConversation.messages[messageIndex] = message;
                }
                
                // 创建新版本
                const newVersion = {
                    content: assistantMessage,
                    reasoning_content: reasoningBox ? reasoningBox.getContent() : null,
                    reasoning_summary: reasoningBox ? reasoningBox.getSummary() : null, // 保存摘要到版本历史
                    thinking_time: reasoningBox ? reasoningBox.getThinkingTime() : null,  // 保存思考时间到版本历史
                    attachments: [],
                    subsequentMessages: [], // 新版本不应该有后续消息，因为重新生成时已经清空了后续消息
                    modelIcon: modelIcon, // 使用当前选择的模型图标
                    modelId: selectedModel // 使用当前选择的模型ID
                };
                
                // 添加到版本历史
                message.versions.push(newVersion);
                message.currentVersion = message.versions.length - 1;
                
                // 更新主消息
                message.content = assistantMessage;
                message.modelIcon = modelIcon; // 更新主消息的模型信息
                message.modelId = selectedModel; // 更新主消息的模型ID
                message.reasoning_content = reasoningBox ? reasoningBox.getContent() : null; // 保存思考内容
                message.reasoning_summary = reasoningBox ? reasoningBox.getSummary() : null; // 保存摘要
                message.thinking_time = reasoningBox ? reasoningBox.getThinkingTime() : null;  // 添加空值检查
                message.attachments = newVersion.attachments;
                
                // 清除当前对话中这条消息后的所有消息
                currentConversation.messages = currentConversation.messages.slice(0, messageIndex + 1);
                
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
                
                // 保存对话
                await saveConversation(currentConversation.id, 'update');
            }
            
            // 清理状态
            if (currentReader) {
                currentReader = null;
            }
            // userInput.disabled = false;
            // console.log("发送按钮触发5");
            // sendButton.textContent = '发送';
            // sendButton.classList.remove('stop');
            // sendButton.disabled = false;
            
            // 移除regenerating标记
            messageDiv.classList.remove('regenerating');
            
        } catch (error) {
            // 清理状态
            if (currentReader) {
                await currentReader.cancel();
                currentReader = null;
            }
            //userInput.disabled = false;
            // console.log("发送按钮触发6");
            // sendButton.textContent = '发送';
            // sendButton.classList.remove('stop');
            // sendButton.disabled = false;
            
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
        console.log("发送按钮触发7");
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

// 添加检测是否支持推理功能的工具函数
function isReasonerModel(modelId) {
    // 首先尝试从DOM中查找，速度更快
    const modelOption = document.querySelector(`option[value="${modelId}"]`);
    if (modelOption) {
        const reasonerAttr = modelOption.getAttribute('data-reasoner');
        if (reasonerAttr !== null) {
            return reasonerAttr === 'true';
        }
    }
    
    // 尝试从选择器中查找所有option元素
    const allOptions = document.querySelectorAll('#model-select option');
    for (const option of allOptions) {
        if (option.value === modelId) {
            const reasonerAttr = option.getAttribute('data-reasoner');
            return reasonerAttr === 'true';
        }
    }
    
    // 如果无法获取模型信息，默认返回false
    return false;
}

// 添加一个确保滚动到底部的函数
function ensureScrollToBottom(container) {
    if (shouldAutoScroll(container)) {
        // 计算需要额外滚动的距离，确保内容不被工具栏覆盖
        const extraScrollPadding = 40; // 添加额外的底部空间
        
        // 立即滚动，确保内容完全可见
        container.scrollTop = container.scrollHeight + extraScrollPadding;
        
        // 设置多个延时滚动，以处理不同类型内容的加载时间差异
        const delays = [50, 150, 300, 500];  // 增加更多的延迟检查点
        delays.forEach(delay => {
            setTimeout(() => {
                // 再次检查是否应该滚动，以尊重用户可能的新滚动行为
                if (shouldAutoScroll(container)) {
                    container.scrollTop = container.scrollHeight + extraScrollPadding;
                }
            }, delay);
        });
    }
}

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
async function processStreamResponse(response, messageDiv, messageContent, options = {}) {
    const { messageIndex, md, chatMessages, shouldScrollToBottom = true } = options;
    console.log("===== processStreamResponse开始 =====");
    console.log("接收到response对象:", response.status, response.statusText);
    console.log("messageIndex:", messageIndex);
    console.log("当前generationStopped状态:", window.generationStopped);
    console.log("当前window.isGenerating状态:", window.isGenerating);
    
    const reader = response.body.getReader();
    console.log("获取reader,reader：", reader);
    console.log("当前currentReader值(赋值前):", currentReader);
    currentReader = reader;
    console.log("设置currentReader完成");
    const decoder = new TextDecoder();
    
    let assistantMessage = '';
    let reasoningBox = null;
    
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
                break;
            }
            
            console.log("准备调用reader.read()");
            const readStart = Date.now();
            const { value, done } = await reader.read();
            const readEnd = Date.now();
            console.log(`reader.read()完成，耗时: ${readEnd - readStart}ms, done:`, done);
            
            if (done) {
                console.log("检测到流结束信号(done=true)");
                // 只有在存在 reasoningBox 时才标记完成
                if (reasoningBox) {
                    console.log("标记reasoningBox完成");
                    reasoningBox.markGenerationComplete();
                }
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
                        
                        // 处理思考内容
                        if (data.reasoning_content) {
                            console.log("处理思考内容:", data.reasoning_content.slice(0, 30) + "...");
                            // 如果还没有创建 reasoningBox，创建一个
                            if (!reasoningBox) {
                                console.log("创建新的reasoningBox");
                                reasoningBox = new ReasoningBox(messageContent, md);
                            }
                            reasoningBox.appendContent(data.reasoning_content);
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
                            if (assistantMessage === '' && reasoningBox) {
                                console.log("标记思考完成，进入生成内容阶段");
                                reasoningBox.markGenerationComplete();
                            }
                            assistantMessage += data.content;
                            console.log("累积的消息内容长度:", assistantMessage.length);
                            // 创建或更新普通内容的容器
                            let textContentDiv = messageContent.querySelector('.text-content');
                            if (!textContentDiv) {
                                console.log("创建文本内容容器");
                                textContentDiv = document.createElement('div');
                                textContentDiv.className = 'text-content';
                                messageContent.appendChild(textContentDiv);
                            }
                            textContentDiv.innerHTML = md.render(assistantMessage);
                            initializeCodeBlocks(textContentDiv);
                            
                            // 检查并处理图片加载完成后的滚动
                            const images = textContentDiv.querySelectorAll('img');
                            if (images.length > 0) {
                                console.log("发现图片:", images.length);
                                images.forEach(img => {
                                    if (!img.complete) {
                                        img.onload = function() {
                                            console.log("图片加载完成，滚动到底部");
                                            ensureScrollToBottom(chatMessages);
                                        };
                                    }
                                });
                            }   
                            
                            // 根据选项决定如何滚动
                            if (shouldScrollToBottom) {
                                console.log("强制滚动到底部");
                                ensureScrollToBottom(chatMessages);
                            } else if (shouldAutoScroll(chatMessages)) {
                                console.log("自动滚动到内容可见");
                                textContentDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
                            }
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
    return { assistantMessage, reasoningBox };
}
