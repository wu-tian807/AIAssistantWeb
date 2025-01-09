// 配置 markdown-it 实例，启用各种功能
import { initMarkdownit ,applyCodeHighlight} from "./utils/markdownit.js";
import { Uploader } from "./utils/attachments/uploader/Uploader.js";
import { AttachmentRenderer } from './utils/attachments/AttachmentRenderer.js';
import { imageUploader } from './utils/attachments/uploader/ImageUploader.js';
import { showToast, confirmDialog,showError } from './utils/toast.js';
import {IconRenderer} from './iconRenderer.js';
import { getLastAssistantModel,updateModelSelect } from './utils/model_selector/modelSelect.js';
import { initializeUserProfile ,initializeTheme} from './user_profiles/userDropdownHandler.js';
import { ModelSettingRenderer } from './model_setting_bar/modelSettingRenderer.js';
const md = initMarkdownit();
// 存储聊天消息历史
let messages = [];
// 当前的流式响应对象
let currentReader = null;

// 获取 DOM 元素
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const attachmentPreview = document.getElementById('attachment-preview');

// 检查是否可以发送消息的函数
function canSendMessage() {
    const hasText = userInput.value.trim().length > 0;
    const hasAttachments = attachmentPreview && attachmentPreview.children.length > 0;
    const stopStatus = sendButton.classList.contains('stop');
    // 如果处于停止状态，总是返回 true
    return stopStatus || hasText || hasAttachments;
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
    if (currentReader) {
        try {
            currentReader.cancel(); // 取消读取流
        } catch (error) {
            console.log('Stream already closed or cancelled:', error);
        }
        currentReader = null;
    }
    sendButton.textContent = '发送';
    sendButton.classList.remove('stop');
    sendButton.disabled = !canSendMessage();  // 使用 canSendMessage 来决定按钮状态
    userInput.disabled = false;
}



// 在文件开头添加一个新的变量来跟踪用户是否正在滚动
let userScrolling = false;
let lastScrollTop = 0;

// 在文件开头添加这个函数
function shouldAutoScroll(container) {
    // 如果用户正在滚动，不自动滚动
    if (userScrolling) return false;
    
    // 检查是否已经滚动到接近底部（距离底部100px以内）
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    return isNearBottom;
}

// 在文件开头定义函数
function createRegenerateButton(messageIndex, messageActions, isError = false) {
    const regenerateBtn = document.createElement('button');
    regenerateBtn.className = 'regenerate-btn';
    regenerateBtn.innerHTML = '🔄 重新生成';
    
    // 根据是否是错误消息选择不同的重新生成函数
    regenerateBtn.onclick = isError ? 
        () => regenerateErrorMessage(messageIndex) : 
        () => regenerateMessage(messageIndex);
    
    // 控制按钮显示状态的函数
    const updateButtonVisibility = () => {
        // 检查是否正在生成（currentReader存在）或发送按钮处于停止状态
        const isGenerating = currentReader || sendButton.classList.contains('stop');
        if (isGenerating) {
            regenerateBtn.style.visibility = 'hidden';
            regenerateBtn.style.opacity = '0';
            regenerateBtn.style.pointerEvents = 'none';
        } else {
            regenerateBtn.style.visibility = 'visible';
            regenerateBtn.style.opacity = '1';
            regenerateBtn.style.pointerEvents = 'auto';
        }
    };
    
    // 初始状态设置
    updateButtonVisibility();
    
    // 定期检查状态
    const visibilityInterval = setInterval(() => {
        updateButtonVisibility();
        // 如果按钮已被移除，清除定时器
        if (!regenerateBtn.isConnected) {
            clearInterval(visibilityInterval);
        }
    }, 100);
    
    messageActions.appendChild(regenerateBtn);
    return regenerateBtn;
}

// 修改后的 appendMessage 函数
function appendMessage(content, isUser = false, messageIndex = null, attachments = [], modelInfo = null,error = false) {
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
                iconInfo = currentConversation.messages[messageIndex].modelIcon;
            }
        }
        const iconRenderer = new IconRenderer(iconInfo);
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'model-icon-wrapper';
        iconWrapper.setAttribute('data-model-icon', iconInfo);
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
    
    // 创建文本内容容器
    const textContent = document.createElement('div');
    textContent.className = 'text-content';
    if (isUser) {
        textContent.textContent = content;
    } else {
        textContent.innerHTML = md.render(content);
        applyCodeHighlight(textContent);
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
        // 添加重新生成按钮
        createRegenerateButton(messageIndex, messageActions, error);
        
        // 如果存在多个版本，添加版本控制
        const message = currentConversationId && conversations.find(c => c.id === currentConversationId)?.messages[messageIndex];
        if (message?.versions?.length > 1) {
            const versionControl = document.createElement('div');
            versionControl.className = 'version-control';
            
            const prevButton = document.createElement('button');
            prevButton.className = 'version-btn';
            prevButton.textContent = '←';
            prevButton.disabled = message.currentVersion === 0;
            prevButton.onclick = () => switchVersion(messageIndex, message.currentVersion - 1);
            
            const nextButton = document.createElement('button');
            nextButton.className = 'version-btn';
            nextButton.textContent = '→';
            nextButton.disabled = message.currentVersion === message.versions.length - 1;
            nextButton.onclick = () => switchVersion(messageIndex, message.currentVersion + 1);
            
            const versionText = document.createElement('span');
            versionText.className = 'version-text';
            versionText.textContent = `版本 ${message.currentVersion + 1}/${message.versions.length}`;
            
            versionControl.appendChild(prevButton);
            versionControl.appendChild(versionText);
            versionControl.appendChild(nextButton);
            messageActions.appendChild(versionControl);
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

    chatMessages.appendChild(messageDiv);
    
    if (shouldAutoScroll(chatMessages)) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// 在文件开头添加新的变量
let conversations = [];
export let currentConversationId = null;

// 在文件开头添加这个变量
const default_system_prompt = `你是一个AI助理。你需要尽可能地满足用户的需求。在页面格式方面有以下提示：请直接输出markdown内容，不要添加额外的代码块标记。如果需要显示代码，直接使用markdown的代码块语法。
对于数学公式，请遵循以下格式：
1. 行内公式：使用单个 $ 符号包裹，例如：$E=mc^2$
2. 独立公式：使用双 $$ 符号包裹，例如：
   $$
   \int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
   $$
3. 带编号的公：使用 equation 环境，例如：
   \begin{equation}
   F = ma
   \end{equation}
4. 多行对齐公式：使用 align 环境，例如：
   $
   \begin{align}
   x &= a + b \\
   y &= c + d
   \end{align}
   $
5. 矩阵：使 matrix、pmatrix、bmatrix 等环境，例如：
   $$
   \begin{pmatrix}
   a & b \\
   c & d
   \end{pmatrix}
   $$

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

请确保公式格式正确，并在适当的场景使用合适的公式环境。`;

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
        await stopGeneration();
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
    if (currentReader) {
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
        
        // 如果对话中保存了模型ID，则切换到该模型
        if (conversation.model_id) {
            modelSelect.value = conversation.model_id;
            // 触发 change 事件以更新其他相关设置
            modelSelect.dispatchEvent(new Event('change'));
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
            appendMessage(msg.content, msg.role === 'user', index, msg.attachments, msg.modelIcon);
        }
    });

    // 检查最后一条消息是否是用户消息
    if (conversation.messages.length > 0) {
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        if (lastMessage.role === 'user') {
            // 创建重新生成按钮容器
            const regenerateContainer = document.createElement('div');
            regenerateContainer.className = 'regenerate-container';
            regenerateContainer.style.cssText = 'text-align: center; margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); animation: fadeIn 0.3s ease-out;';

            const promptText = document.createElement('div');
            promptText.style.cssText = 'color: #666; margin-bottom: 10px; font-size: 14px;';
            promptText.textContent = '检测到对话未完成，是否继续生成回复？';

            const regenerateBtn = document.createElement('button');
            regenerateBtn.className = 'regenerate-btn';
            regenerateBtn.innerHTML = '🔄 继续生成回复';
            regenerateBtn.style.cssText = 'padding: 10px 20px; font-size: 15px; background-color: #007AFF; color: white; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s ease;';
            
            regenerateBtn.onmouseover = () => regenerateBtn.style.backgroundColor = '#0056b3';
            regenerateBtn.onmouseout = () => regenerateBtn.style.backgroundColor = '#007AFF';
            
            regenerateBtn.onclick = async () => {
                regenerateContainer.remove();
                await regenerateErrorMessage(conversation.messages.length);
            };

            regenerateContainer.appendChild(promptText);
            regenerateContainer.appendChild(regenerateBtn);
            chatMessages.appendChild(regenerateContainer);

            // 添加淡入动画样式
            const style = document.createElement('style');
            style.textContent = '@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }';
            document.head.appendChild(style);
        }
        else{
            //动态加载默认选择的模型为最后一条模型的类别
            //使用import { getLastAssistantModel,updateModelSelect } from './utils/model_selector/modelSelect.js';
            const lastModel = getLastAssistantModel({messages: conversation.messages});
            console.log('lastModel:', lastModel);
            if (lastModel) {
                const modelSelect = document.querySelector('#model-select');
                updateModelSelect(lastModel.modelId, modelSelect);
            }
        }
    }

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
async function sendMessage(retryCount = 3, retryDelay = 1000) {
    let error = false;
    const content = userInput.value.trim();

    if (!content && !hasAttachments()) return;

    // 获取选中的模型ID和类型
    const modelSelect = document.getElementById('model-select');
    const selectedOption = modelSelect.options[modelSelect.selectedIndex];
    const modelIcon = selectedOption.getAttribute('data-model-icon');
    const modelSettings = window.modelSettingRenderer.getSettings();
    const temperature = modelSettings.temperature;
    const max_tokens = modelSettings.current_output_tokens;

    console.log('Model selection:', {
        selectedValue: modelSelect.value,
        optgroup: selectedOption.closest('optgroup')?.label,
        modelIcon: modelIcon,
        temperature: temperature,
        max_tokens: max_tokens
    });

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
    sendButton.disabled = !canSendMessage();
    userInput.disabled = false;

    let assistantMessage = '';
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
    
    createRegenerateButton(messageIndex, messageActions, false);
    
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
                    messages: messages,
                    conversation_id: currentConversationId,
                    model_id: selectedModel,
                    temperature: temperature,
                    max_tokens: max_tokens
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            currentReader = reader;
            const decoder = new TextDecoder();

            while (true) {
                try {
                    const { value, done } = await reader.read();
                    if (done) break;

                    const text = decoder.decode(value);
                    const lines = text.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                if (data.error) {
                                    throw new Error(data.error);
                                }
                                if (data.content) {
                                    assistantMessage += data.content;
                                    messageContent.innerHTML = md.render(assistantMessage);
                                    applyCodeHighlight(messageContent);

                                    if (shouldAutoScroll(chatMessages)) {
                                        chatMessages.scrollTop = chatMessages.scrollHeight;
                                    }
                                }
                            } catch (e) {
                                console.error(`[${new Date().toISOString()}] 解析SSE数据失败:`, e);
                                throw e;
                            }
                        }
                    }
                } catch (e) {
                    if (e.name === 'AbortError') {
                        console.log('Stream was cancelled');
                        break;
                    }
                    throw e;
                }
            }

            // 成功接收到内容，保存到消息历史
            if (assistantMessage.trim()) {
                currentConversation.messages.push({ 
                    role: "assistant", 
                    content: assistantMessage, 
                    modelIcon: modelIcon,
                    modelId: selectedModel,
                    versions: [{
                        content: assistantMessage,
                        attachments: [],
                        subsequentMessages: [],
                        modelIcon: modelIcon,
                        modelId: selectedModel
                    }],
                    currentVersion: 0
                });
                await saveConversation(currentConversation.id, 'update');
            }

            // 如果成功，跳出重试循环
            break;

        } catch (error) {
            console.error(`[${new Date().toISOString()}] 发送消息失败 (尝试 ${attempt + 1}/${retryCount}):`, {
                error: error.message,
                stack: error.stack,
                networkStatus: navigator.onLine ? '在线' : '离线',
                readyState: document.readyState
            });

            // 清理状态
            if (currentReader) {
                try {
                    await currentReader.cancel();
                } catch (e) {
                    console.log('Error cancelling stream:', e);
                }
                currentReader = null;
            }

            // 如果是最后一次尝试，显示错误
            if (attempt === retryCount - 1) {
                messageDiv.classList.add('error-message');
                messageContent.innerHTML = md.render('发生错误，请重试\n' + error.message);
                messageActions.innerHTML = '';
                createRegenerateButton(messageIndex, messageActions, true);
                error = true;
            } else {
                // 等待一段时间后重试
                console.log(`[${new Date().toISOString()}] 等待 ${retryDelay}ms 后重试...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
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
    
    userInput.disabled = false;
    sendButton.textContent = '发送';
    sendButton.classList.remove('stop');
    sendButton.disabled = false;
    userInput.focus();
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
    initializeDragAndDrop();
    initializePasteHandler();
    initializeTheme(); // 添加主题初始化
    initializeUserProfile(); // 添加用户配置初始化
    
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
            
            // 计算新的 current_output_tokens：
            // 如果当前值超过新的最大值，使用新的最大值
            // 否则保持当前值
            const newCurrentTokens = currentSettings.current_output_tokens > newMaxTokens 
                ? newMaxTokens 
                : currentSettings.current_output_tokens;

            window.modelSettingRenderer.setSettings({
                max_output_tokens: newMaxTokens,
                default_output_tokens: Math.floor(newMaxTokens / 2),
                current_output_tokens: newCurrentTokens,  // 使用计算后的值
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
        if (currentScrollTop !== lastScrollTop) {
            userScrolling = true;
            clearTimeout(window.scrollTimeout);
            window.scrollTimeout = setTimeout(() => {
                userScrolling = false;
            }, 1000);
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
    const code = pre.querySelector('code');
    const text = code.innerText;

    navigator.clipboard.writeText(text).then(() => {
        button.textContent = '已复制！';
        button.classList.add('copied');
        
        setTimeout(() => {
            button.textContent = '复制代码';
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('复制失败:', err);
        button.textContent = '复制失败';
        
        setTimeout(() => {
            button.textContent = '复制代码';
        }, 2000);
    });
}

// 确保 copyCode 函数在全局范围可用
window.copyCode = copyCode; 

// 修改重新生成消息的函数
async function regenerateMessage(messageIndex) {
    const sendButton = document.getElementById('send-button');
    if (sendButton.classList.contains('stop')) {
        sendButton.disabled = false;
    }
    if (!currentConversationId) return;
    
    const currentConversation = conversations.find(c => c.id === currentConversationId);
    if (!currentConversation) return;
    
    const message = currentConversation.messages[messageIndex];
    if (!message || message.role !== 'assistant') return;
    
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
    userInput.disabled = false;  // 禁用输入框
    
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

        // 保存 reader 对象以便能够中断它
        const reader = response.body.getReader();
        currentReader = reader;
        const decoder = new TextDecoder();
        
        let assistantMessage = '';
        
        // 获取当前消息元素
        const messageDiv = chatMessages.children[messageIndex];
        messageDiv.classList.remove('error-message');
        const messageContent = messageDiv.querySelector('.message-content');

                
        if (!response.ok){
            console.log(`HTTP error! status: ${response.status}`);
            messageDiv.classList.add('error-message');
            messageContent.innerHTML = md.render('发生错误，请重试\n'+response.status);
            return;
        }

        // 更新模型图标为新版本的图标
        const iconWrapper = messageDiv.querySelector('.model-icon-wrapper');
        if (iconWrapper) {
            const iconRenderer = new IconRenderer(modelIcon);
            iconWrapper.innerHTML = '';
            iconWrapper.setAttribute('data-model-icon', modelIcon);
            iconWrapper.appendChild(iconRenderer.modelIcon);
        }

        // 循环读取响应流
        while (true) {
            try {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.error) {
                                console.error('Server error:', data.error);
                                messageDiv.classList.add('error-message');
                                messageContent.innerHTML = md.render('发生错误，请重试\n'+data.error);
                            } else if (data.content) {
                                assistantMessage += data.content;
                                messageContent.innerHTML = md.render(assistantMessage);
                                applyCodeHighlight(messageContent);
                                if (shouldAutoScroll(chatMessages)) {
                                    chatMessages.scrollTop = chatMessages.scrollHeight;
                                }
                            }
                        } catch (e) {
                            console.error('解析标题SSE数据出错:', e, '原始数据:', line);
                            messageDiv.classList.add('error-message');
                            messageContent.innerHTML = md.render('发生错误，请重试\n'+e.message);
                        }
                    }
                }
            } catch (error) {
                if (error.name === 'AbortError' || error.name === 'CancelError') {
                    messageDiv.classList.add('error-message');
                    console.log('Stream reading cancelled');
                    break;
                }
                throw error;
            }
        }
        
        if (assistantMessage.trim()) {
            // 创建新版本，新版本不包含任何后续消息
            const newVersion = {
                content: assistantMessage,
                attachments: message.attachments || [], // 保留原有附件
                subsequentMessages: [],  // 新版本不包含任何后续消息
                modelIcon: modelIcon,  // 添加模型图标信息
                modelId: selectedModel  // 添加模型ID信息
            };
            
            // 将新的版本添加到versions数组
            message.versions.push(newVersion);
            message.currentVersion = message.versions.length - 1;
            
            // 更新当前消息的内容和附件，但不更新模型信息
            message.content = assistantMessage;
            message.attachments = newVersion.attachments;
            
            // 清除当前对话中这条消息后的所有消息
            currentConversation.messages = currentConversation.messages.slice(0, messageIndex + 1);
            
            // 清除UI中的消息
            while (chatMessages.children.length > messageIndex + 1) {
                chatMessages.removeChild(chatMessages.lastChild);
            }
            
            // 更新UI，添加版本控制和重新生成按钮
            const messageWrapper = messageDiv.querySelector('.message-wrapper');
            const messageActions = messageWrapper.querySelector('.message-actions');
            messageActions.innerHTML = ''; // 清空现有按钮
            
            // 添加版本控制
            if (message.versions.length > 1) {
                const versionControl = document.createElement('div');
                versionControl.className = 'version-control';
                
                const prevButton = document.createElement('button');
                prevButton.className = 'version-btn';
                prevButton.textContent = '←';
                prevButton.disabled = message.currentVersion === 0;
                prevButton.onclick = () => switchVersion(messageIndex, message.currentVersion - 1);
                
                const nextButton = document.createElement('button');
                nextButton.className = 'version-btn';
                nextButton.textContent = '→';
                nextButton.disabled = message.currentVersion === message.versions.length - 1;
                nextButton.onclick = () => switchVersion(messageIndex, message.currentVersion + 1);
                
                const versionText = document.createElement('span');
                versionText.className = 'version-text';
                versionText.textContent = `版本 ${message.currentVersion + 1}/${message.versions.length}`;
                
                versionControl.appendChild(prevButton);
                versionControl.appendChild(versionText);
                versionControl.appendChild(nextButton);
                messageActions.appendChild(versionControl);
            }
            
            // 添加重新生成按钮
            const regenerateBtn = document.createElement('button');
            regenerateBtn.className = 'regenerate-btn';
            regenerateBtn.innerHTML = '🔄 重新生成';
            regenerateBtn.onclick = () => regenerateMessage(messageIndex);
            messageActions.appendChild(regenerateBtn);
            
            // 保存对话
            await saveConversation(currentConversation.id, 'update');
        }
    } catch (error) {
        console.error('Error:', error);
        const messageDiv = chatMessages.children[messageIndex];
        messageDiv.classList.add('error-message');
        messageContent.innerHTML = md.render('发生错误，请重试\n'+error);
    } finally {
        if (currentReader) {
            try {
                await currentReader.cancel();
            } catch (e) {
                const messageDiv = chatMessages.children[messageIndex];
                messageDiv.classList.add('error-message');
                messageContent.innerHTML = md.render('发生错误，请重试\n'+e.message);
                console.log('Error cancelling stream:', e);
            }
            currentReader = null;
        }
        userInput.disabled = false;
        sendButton.textContent = '发送';
        sendButton.classList.remove('stop');
        sendButton.disabled = false;
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
                    
                    // 获取现有的消息元素
                    const messageDiv = chatMessages.children[i];
                    if (!messageDiv) {
                        console.error('未找到消息元素');
                        continue;
                    }

                    // 获取消息内容元素
                    const messageContent = messageDiv.querySelector('.message-content');
                    if (!messageContent) {
                        console.error('未找到消息内容元素');
                        continue;
                    }

                    // 清空现有内容
                    messageContent.innerHTML = '';
                    messageDiv.classList.remove('error-message');

                    try {
                        // 获取选中的模型ID和图标信息
                        const modelSelect = document.getElementById('model-select');
                        const selectedOption = modelSelect.options[modelSelect.selectedIndex];
                        const selectedModel = modelSelect.value;
                        const modelIcon = selectedOption.getAttribute('data-model-icon');
                        
                        if (!selectedModel) {
                            throw new Error('请选择一个模型');
                        }

                        // 更新模型图标
                        const iconWrapper = messageDiv.querySelector('.model-icon-wrapper');
                        if (iconWrapper) {
                            const iconRenderer = new IconRenderer(modelIcon);
                            iconWrapper.innerHTML = '';
                            iconWrapper.setAttribute('data-model-icon', modelIcon);
                            iconWrapper.appendChild(iconRenderer.modelIcon);
                        }

                        // 准备消息历史
                        const messagesUntilIndex = conversation.messages.slice(0, i);
                        const messages = [
                            {"role": "system", "content": conversation.systemPrompt || default_system_prompt},
                            ...messagesUntilIndex
                        ];

                        // 发送请求
                        const response = await fetch('/chat', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ 
                                messages: messages,
                                conversation_id: currentConversationId,
                                model_id: selectedModel
                            })
                        });

                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }

                        const reader = response.body.getReader();
                        const decoder = new TextDecoder();
                        let assistantMessage = '';

                        while (true) {
                            const { value, done } = await reader.read();
                            if (done) break;

                            const chunk = decoder.decode(value);
                            const lines = chunk.split('\n');

                            for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                    const data = JSON.parse(line.slice(6));
                                    if (data.content) {
                                        assistantMessage += data.content;
                                        messageContent.innerHTML = md.render(assistantMessage);
                                        applyCodeHighlight(messageContent);
                                    }
                                }
                            }
                        }

                        // 更新消息内容
                        if (assistantMessage.trim()) {
                            conversation.messages[i] = {
                                role: "assistant",
                                content: assistantMessage,
                                modelIcon: modelIcon,
                                modelId: selectedModel,
                                versions: [{
                                    content: assistantMessage,
                                    attachments: [],
                                    subsequentMessages: [],
                                    modelIcon: modelIcon,
                                    modelId: selectedModel
                                }],
                                currentVersion: 0
                            };

                            // 删除后续消息
                            conversation.messages = conversation.messages.slice(0, i + 1);
                            while (chatMessages.children.length > i + 1) {
                                chatMessages.removeChild(chatMessages.lastChild);
                            }

                            // 保存对话
                            await saveConversation(conversation.id, 'update');
                        }

                    } catch (error) {
                        console.error('重新生成失败:', error);
                        messageDiv.classList.add('error-message');
                        messageContent.innerHTML = md.render('发生错误，请重试\n' + error.message);
                    }
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
function switchVersion(messageIndex, newVersion) {
    const currentConversation = conversations.find(c => c.id === currentConversationId);
    if (!currentConversation) return;
    
    const message = currentConversation.messages[messageIndex];
    if (!message || !message.versions || !message.versions[newVersion]) return;
    
    // 在切换版本之前，保存当前版本的后续对话
    const currentVersion = message.currentVersion;
    if (typeof currentVersion !== 'undefined') {
        const currentVersionData = message.versions[currentVersion];
        if (currentVersionData) {
            currentVersionData.subsequentMessages = currentConversation.messages.slice(messageIndex + 1);
        }
    }
    
    // 更新当前版本
    message.currentVersion = newVersion;
    const selectedVersion = message.versions[newVersion];
    
    // 更新消息内容和附件
    message.content = selectedVersion.content;
    message.attachments = selectedVersion.attachments || [];
    
    // 如果有模型ID，更新模型选择器
    if (selectedVersion.modelId) {
        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
            modelSelect.value = selectedVersion.modelId;
            // 触发 change 事件以更新标题栏图标
            const event = new Event('change');
            modelSelect.dispatchEvent(event);
        }
    }
    
    // 恢复选中版本的后续对话（如果有）
    if (selectedVersion.subsequentMessages) {
        currentConversation.messages = [
            ...currentConversation.messages.slice(0, messageIndex + 1),
            ...selectedVersion.subsequentMessages
        ];
    } else {
        // 如果没有后续对话记录，则清除后续消息
        currentConversation.messages = currentConversation.messages.slice(0, messageIndex + 1);
    }
    
    // 更新全局消息数组
    messages = [
        {"role": "system", "content": currentConversation.systemPrompt || default_system_prompt},
        ...currentConversation.messages
    ];
    
    // 更新UI：清除并重建后续消息
    const chatMessages = document.getElementById('chat-messages');
    while (chatMessages.children.length > messageIndex + 1) {
        chatMessages.removeChild(chatMessages.lastChild);
    }
    
    // 重新渲染后续消息（如果有）
    if (selectedVersion.subsequentMessages) {
        selectedVersion.subsequentMessages.forEach((msg, idx) => {
            const absoluteIndex = messageIndex + 1 + idx;
            appendMessage(msg.content, msg.role === 'user', absoluteIndex, msg.attachments, msg.modelIcon);
        });
    }
    
    // 更新当前消息的UI
    const messageDiv = chatMessages.children[messageIndex];
    if(messageDiv && messageDiv.classList.contains('error-message')){
        messageDiv.classList.remove('error-message');
    }
    const messageContent = messageDiv.querySelector('.message-content');
    messageContent.innerHTML = md.render(message.content);
    applyCodeHighlight(messageContent);
    
    // 更新模型图标为当前版本的图标
    const iconWrapper = messageDiv.querySelector('.model-icon-wrapper');
    if (iconWrapper && selectedVersion.modelIcon) {
        const iconRenderer = new IconRenderer(selectedVersion.modelIcon);
        iconWrapper.innerHTML = '';
        iconWrapper.setAttribute('data-model-icon', selectedVersion.modelIcon);
        iconWrapper.appendChild(iconRenderer.modelIcon);
    }
    
    // 更新附件显示
    const existingAttachmentsContainer = messageDiv.querySelector('.message-attachments-container');
    if (existingAttachmentsContainer) {
        existingAttachmentsContainer.remove();
    }
    
    if (message.attachments && message.attachments.length > 0) {
        const attachmentsContainer = document.createElement('div');
        attachmentsContainer.className = 'message-attachments-container';
        
        const attachmentRenderer = new AttachmentRenderer();
        message.attachments.forEach(attachment => {
            let renderedElement;
            
            if (attachment.type === 'video') {
                // 视频附件：使用 file_path 和 thumbnail_base64_id
                renderedElement = attachmentRenderer.render({
                    type: 'video',
                    filename: attachment.fileName,
                    file_path: attachment.file_path,
                    mime_type: attachment.mime_type,
                    duration: attachment.duration,
                    thumbnail_base64_id: attachment.thumbnail_base64_id,
                    disableDelete: true
                });
            } else {
                // 图片附件：使用 base64_id
                renderedElement = attachmentRenderer.render({
                    type: 'image',
                    filename: attachment.fileName,
                    mime_type: attachment.mime_type,
                    file_path: attachment.file_path,
                    base64_id: attachment.base64_id,
                    disableDelete: true
                });
            }
            
            if (renderedElement) {
                attachmentsContainer.appendChild(renderedElement);
            }
        });
        
        if (attachmentsContainer.children.length > 0) {
            messageDiv.appendChild(attachmentsContainer);
        }
    }
    
    // 更新版本控制按钮状态
    const messageActions = messageDiv.querySelector('.message-actions');
    if (messageActions) {
        messageActions.innerHTML = '';
        
        // 重新添加重新生成按钮
        const regenerateBtn = document.createElement('button');
        regenerateBtn.className = 'regenerate-btn';
        regenerateBtn.innerHTML = '🔄 重新生成';
        regenerateBtn.onclick = () => regenerateMessage(messageIndex);
        messageActions.appendChild(regenerateBtn);
        
        // 重新添加版本控制
        if (message.versions.length > 1) {
            const versionControl = document.createElement('div');
            versionControl.className = 'version-control';
            
            const prevButton = document.createElement('button');
            prevButton.className = 'version-btn';
            prevButton.textContent = '←';
            prevButton.disabled = newVersion === 0;
            prevButton.onclick = () => switchVersion(messageIndex, newVersion - 1);
            
            const nextButton = document.createElement('button');
            nextButton.className = 'version-btn';
            nextButton.textContent = '→';
            nextButton.disabled = newVersion === message.versions.length - 1;
            nextButton.onclick = () => switchVersion(messageIndex, newVersion + 1);
            
            const versionText = document.createElement('span');
            versionText.className = 'version-text';
            versionText.textContent = `版本 ${newVersion + 1}/${message.versions.length}`;
            
            versionControl.appendChild(prevButton);
            versionControl.appendChild(versionText);
            versionControl.appendChild(nextButton);
            messageActions.appendChild(versionControl);
        }
    }
    
    // 保存到数据库
    saveConversation(currentConversation.id, 'update');
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
    }
    // 获取当前对话
    if (!currentConversationId) return;
    const currentConversation = conversations.find(c => c.id === currentConversationId);
    if (!currentConversation) return;
    
    // 获取聊天消息容器
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) {
        console.error('找不到聊天消息容器');
        return;
    }

    // 检查是否已经存在助手消息
    const existingMessage = currentConversation.messages[messageIndex];
    if (existingMessage && existingMessage.role === 'assistant') {
        // 如果已经存在助手消息，使用普通的regenerateMessage
        return regenerateMessage(messageIndex);
    }
    
    // 获取到指定消息之前的所有消息
    const messagesUntilIndex = currentConversation.messages.slice(0, messageIndex);
    
    // 设置messages数组用于API请求
    messages = [
        {"role": "system", "content": currentConversation.systemPrompt || default_system_prompt},
        ...messagesUntilIndex
    ];
    
    // 禁用发送按钮，显示停止按钮
    sendButton.textContent = '停止';
    sendButton.classList.add('stop');

    // 创建新的消息元素
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant-message';
    messageDiv.setAttribute('data-message-index', messageIndex);
    
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

        // 移除旧的错误消息（如果存在）
        const oldMessageDiv = chatMessages.querySelector(`[data-message-index="${messageIndex}"]`);
        if (oldMessageDiv) {
            oldMessageDiv.remove();
        }

        // 创建并添加模型图标
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'model-icon-wrapper';
        iconWrapper.setAttribute('data-model-icon', modelIcon);
        const iconRenderer = new IconRenderer(modelIcon);
        iconWrapper.appendChild(iconRenderer.modelIcon);
        messageDiv.appendChild(iconWrapper);

        // 创建消息包装器
        const messageWrapper = document.createElement('div');
        messageWrapper.className = 'message-wrapper';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = ''; // 初始化为空内容
        
        const messageActions = document.createElement('div');
        messageActions.className = 'message-actions';
        
        // 添加重新生成按钮
        createRegenerateButton(messageIndex, messageActions, false);
        
        messageWrapper.appendChild(messageContent);
        messageWrapper.appendChild(messageActions);
        messageDiv.appendChild(messageWrapper);
        
        // 插入到正确的位置
        if (messageIndex < chatMessages.children.length) {
            chatMessages.insertBefore(messageDiv, chatMessages.children[messageIndex]);
        } else {
            chatMessages.appendChild(messageDiv);
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
            // 清理状态
            if (currentReader) {
                await currentReader.cancel();
                currentReader = null;
            }
            userInput.disabled = false;
            sendButton.textContent = '发送';
            sendButton.classList.remove('stop');
            sendButton.disabled = false;
            
            messageDiv.classList.add('error-message');
            messageContent.innerHTML = md.render('发生错误，请重试\n'+response.status);
            
            // 重新创建重新生成按钮
            messageActions.innerHTML = '';
            createRegenerateButton(messageIndex, messageActions, true);
            return;
        }

        const reader = response.body.getReader();
        currentReader = reader;
        const decoder = new TextDecoder();
        let assistantMessage = '';

        // 循环读取响应流
        while (true) {
            try {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.error) {
                                // 清理状态
                                if (currentReader) {
                                    await currentReader.cancel();
                                    currentReader = null;
                                }
                                userInput.disabled = false;
                                sendButton.textContent = '发送';
                                sendButton.classList.remove('stop');
                                sendButton.disabled = false;
                                
                                messageDiv.classList.add('error-message');
                                messageContent.innerHTML = md.render('发生错误，请重试\n'+data.error);
                                
                                // 重新创建重新生成按钮
                                messageActions.innerHTML = '';
                                createRegenerateButton(messageIndex, messageActions, true);
                                throw new Error(data.error);
                            } else if (data.content) {
                                assistantMessage += data.content;
                                messageContent.innerHTML = md.render(assistantMessage);
                                applyCodeHighlight(messageContent);
                                if (shouldAutoScroll(chatMessages)) {
                                    chatMessages.scrollTop = chatMessages.scrollHeight;
                                }
                            }
                        } catch (e) {
                            // 清理状态
                            if (currentReader) {
                                await currentReader.cancel();
                                currentReader = null;
                            }
                            userInput.disabled = false;
                            sendButton.textContent = '发送';
                            sendButton.classList.remove('stop');
                            sendButton.disabled = false;
                            
                            messageDiv.classList.add('error-message');
                            messageContent.innerHTML = md.render('发生错误，请重试\n'+e.message);
                            
                            // 重新创建重新生成按钮
                            messageActions.innerHTML = '';
                            createRegenerateButton(messageIndex, messageActions, true);
                            break;
                        }
                    }
                }
            } catch (error) {
                if (error.name === 'AbortError' || error.name === 'CancelError') {
                    // 清理状态
                    if (currentReader) {
                        await currentReader.cancel();
                        currentReader = null;
                    }
                    userInput.disabled = false;
                    sendButton.textContent = '发送';
                    sendButton.classList.remove('stop');
                    sendButton.disabled = false;
                    
                    messageDiv.classList.add('error-message');
                    messageContent.innerHTML = md.render('生成被中断');
                    
                    // 重新创建重新生成按钮
                    messageActions.innerHTML = '';
                    createRegenerateButton(messageIndex, messageActions, true);
                    break;
                }
                // 清理状态
                if (currentReader) {
                    await currentReader.cancel();
                    currentReader = null;
                }
                userInput.disabled = false;
                sendButton.textContent = '发送';
                sendButton.classList.remove('stop');
                sendButton.disabled = false;
                
                messageDiv.classList.add('error-message');
                messageContent.innerHTML = md.render('发生错误，请重试\n'+error.message);
                
                // 重新创建重新生成按钮
                messageActions.innerHTML = '';
                createRegenerateButton(messageIndex, messageActions, true);
                throw error;
            }
        }
        
        if (assistantMessage.trim()) {
            // 检查是否已经存在助手消息
            if (existingMessage && existingMessage.role === 'assistant') {
                // 如果存在，更新现有消息
                existingMessage.content = assistantMessage;
                existingMessage.modelIcon = modelIcon;
                existingMessage.modelId = selectedModel;
                if (!existingMessage.versions) {
                    existingMessage.versions = [];
                }
                existingMessage.versions.push({
                    content: assistantMessage,
                    attachments: [],
                    subsequentMessages: [],
                    modelIcon: modelIcon,
                    modelId: selectedModel
                });
                existingMessage.currentVersion = existingMessage.versions.length - 1;
            } else {
                // 如果不存在，创建新消息
                const newMessage = {
                    role: "assistant",
                    content: assistantMessage,
                    modelIcon: modelIcon,
                    modelId: selectedModel,
                    versions: [{
                        content: assistantMessage,
                        attachments: [],
                        subsequentMessages: [],
                        modelIcon: modelIcon,
                        modelId: selectedModel
                    }],
                    currentVersion: 0
                };

                // 替换或添加消息
                if (messageIndex < currentConversation.messages.length) {
                    currentConversation.messages[messageIndex] = newMessage;
                } else {
                    currentConversation.messages.push(newMessage);
                }
            }

            // 更新UI，添加版本控制
            if (existingMessage?.versions?.length > 1) {
                const versionControl = document.createElement('div');
                versionControl.className = 'version-control';
                
                const prevButton = document.createElement('button');
                prevButton.className = 'version-btn';
                prevButton.textContent = '←';
                prevButton.disabled = existingMessage.currentVersion === 0;
                prevButton.onclick = () => switchVersion(messageIndex, existingMessage.currentVersion - 1);
                
                const nextButton = document.createElement('button');
                nextButton.className = 'version-btn';
                nextButton.textContent = '→';
                nextButton.disabled = existingMessage.currentVersion === existingMessage.versions.length - 1;
                nextButton.onclick = () => switchVersion(messageIndex, existingMessage.currentVersion + 1);
                
                const versionText = document.createElement('span');
                versionText.className = 'version-text';
                versionText.textContent = `版本 ${existingMessage.currentVersion + 1}/${existingMessage.versions.length}`;
                
                versionControl.appendChild(prevButton);
                versionControl.appendChild(versionText);
                versionControl.appendChild(nextButton);
                messageActions.appendChild(versionControl);
            }
            
            // 保存对话
            await saveConversation(currentConversation.id, 'update');
        }
    } catch (error) {
        console.error('Error:', error);
        messageDiv.classList.add('error-message');
        const content = messageDiv.querySelector('.message-content');
        if (content) {
            content.innerHTML = md.render('发生错误，请重试\n'+error.message);
        }
    } finally {
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
        sendButton.disabled = false;
    }
}



