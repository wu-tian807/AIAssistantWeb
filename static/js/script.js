// 配置 markdown-it 实例，启用各种功能
import { initMarkdownit ,applyCodeHighlight} from "./utils/markdownit.js";
import { Uploader } from "./utils/attachments/uploader/Uploader.js";
import { AttachmentRenderer } from './utils/attachments/AttachmentRenderer.js';
import { imageUploader } from './utils/attachments/uploader/ImageUploader.js';
import { showToast, confirmDialog,showError } from './utils/toast.js';

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
    return hasText || hasAttachments;
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
        if (!sendButton.disabled) {
            sendMessage();
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
    sendButton.disabled = false;
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

// // 定义支持的自定义附件类型
// const SUPPORTED_ATTACHMENT_TYPES = ['image', 'documents', 'text', 'audio', 'video', 'binary'];
// // 附件处理函数
// function createAttachmentElement(attachment) {
//     // 类型校验
//     if (!attachment || !attachment.type || !SUPPORTED_ATTACHMENT_TYPES.includes(attachment.type)) {
//         console.warn(`Invalid or unsupported attachment type: ${attachment?.type}`);
//         return null;
//     }
    
//     // 如果有 mime_type，使用它来决定类型
//     if (attachment.mime_type) {
//         const customType = FILE_TYPE_MAPPING[attachment.mime_type];
//         switch (customType) {
//             case 'image':
//                 return createImageAttachment(attachment);
//             case 'video':
//                 return createVideoAttachment(attachment);
//             case 'file':
//                 return createFileAttachment(attachment);
//             default:
//                 return null;
//         }
//     }
    
//     // 如果没有 mime_type，使用 type 字段
//     switch (attachment.type) {
//         case 'image':
//             return createImageAttachment(attachment);
//         case 'video':
//             return createVideoAttachment(attachment);
//         case 'file':
//             return createFileAttachment(attachment);
//         default:
//             return null;
//     }
// }
// // 图片附件处理
// function createImageAttachment(attachment) {
//     const imgWrapper = document.createElement('div');
//     imgWrapper.className = 'message-image-wrapper';
    
//     const img = document.createElement('img');
//     img.src = `data:image/jpeg;base64,${attachment.base64}`;
//     img.alt = attachment.fileName;
//     img.className = 'message-image';
    
//     // 添加点击放大功能
//     img.onclick = () => createImageModal(img.src);
    
//     imgWrapper.appendChild(img);
//     return imgWrapper;
// }

// // 创建图片模态框
// function createImageModal(src) {
//     const modal = document.createElement('div');
//     modal.className = 'image-modal';
    
//     // 创建关闭按钮
//     const closeBtn = document.createElement('button');
//     closeBtn.className = 'modal-close-btn';
//     closeBtn.innerHTML = '×';
    
//     const modalImg = document.createElement('img');
//     modalImg.src = src;
//     modalImg.className = 'modal-image';
    
//     // 添加关闭按钮和图片到模态框
//     modal.appendChild(closeBtn);
//     modal.appendChild(modalImg);
//     document.body.appendChild(modal);
    
//     // 处理关闭事件
//     const closeModal = () => {
//         modal.classList.add('modal-closing');
//         setTimeout(() => modal.remove(), 300); // 等待动画完成后移除
//     };
    
//     // 点击关闭按钮关闭
//     closeBtn.onclick = (e) => {
//         e.stopPropagation();
//         closeModal();
//     };
    
//     // 点击模态框背景关闭
//     modal.onclick = (e) => {
//         if (e.target === modal) {
//             closeModal();
//         }
//     };
    
//     // 按 ESC 键关闭
//     const handleKeyDown = (e) => {
//         if (e.key === 'Escape') {
//             closeModal();
//             document.removeEventListener('keydown', handleKeyDown);
//         }
//     };
//     document.addEventListener('keydown', handleKeyDown);
    
//     // 防止滚动穿透
//     document.body.style.overflow = 'hidden';
//     modal.addEventListener('remove', () => {
//         document.body.style.overflow = '';
//     });
// }

// // 预留的视频附件处理函数
// function createVideoAttachment(attachment) {
//     // TODO: 实现视频附件处理
//     return null;
// }

// // 预留的文件附件处理函数
// function createFileAttachment(attachment) {
//     // TODO: 实现文件附件处理
//     return null;
// }

// // 创建附件容器
// function createAttachmentsContainer(attachments) {
//     if (!attachments || attachments.length === 0) return null;
    
//     const container = document.createElement('div');
//     container.className = 'message-attachments';
    
//     // 根据附件类型分组
//     const attachmentsByType = attachments.reduce((acc, attachment) => {
//         if (!acc[attachment.type]) {
//             acc[attachment.type] = [];
//         }
//         acc[attachment.type].push(attachment);
//         return acc;
//     }, {});
    
//     // 处理每种类型的附件
//     Object.entries(attachmentsByType).forEach(([type, items]) => {
//         const typeContainer = document.createElement('div');
//         typeContainer.className = `message-${type}s`;
        
//         items.forEach(item => {
//             const element = createAttachmentElement(item);
//             if (element) {
//                 typeContainer.appendChild(element);
//             }
//         });
        
//         container.appendChild(typeContainer);
//     });
    
//     return container;
// }

// 修改后的 appendMessage 函数
function appendMessage(content, isUser = false, messageIndex = null, attachments = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;
    
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
    
    const messageActions = document.createElement('div');
    messageActions.className = 'message-actions';
    
    if (isUser) {
        // 创建文本内容容器
        const textContent = document.createElement('div');
        textContent.className = 'text-content';
        textContent.textContent = content;
        messageContent.appendChild(textContent);
        
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
        
        // 处理附件 - 移到消息框外部
        if (attachments && attachments.length > 0) {
            console.log('开始处理附件:', attachments);  // 调试日志
            const attachmentRenderer = new AttachmentRenderer();
            const attachmentsContainer = document.createElement('div');
            attachmentsContainer.className = 'message-attachments-container';
            
            attachments.forEach(attachment => {
                console.log('处理单个附件:', attachment);  // 调试日志
                if (!attachment || (!attachment.base64 && !attachment.file_path)) {
                    console.error('无效的附件数据:', attachment);
                    return;
                }
                
                let url;
                if (attachment.base64) {
                    url = attachment.base64.startsWith('data:') ? 
                        attachment.base64 : 
                        `data:${attachment.mime_type};base64,${attachment.base64}`;
                } else if (attachment.file_path) {
                    url = `/get_image?path=${encodeURIComponent(attachment.file_path)}`;
                }

                const renderedAttachment = attachmentRenderer.render({
                    type: attachment.type || 'image',  // 默认为图片类型
                    base64: attachment.base64,
                    filename: attachment.fileName || 'file',
                    url: url,
                    disableDelete: true,
                    // 视频特有属性
                    duration: attachment.duration,
                    thumbnail: attachment.thumbnail
                });
                
                console.log('渲染结果:', renderedAttachment);  // 调试日志
                if (renderedAttachment) {
                    attachmentsContainer.appendChild(renderedAttachment);
                }
            });
            
            console.log('附件容器子元素数量:', attachmentsContainer.children.length);  // 调试日志
            if (attachmentsContainer.children.length > 0) {
                messageDiv.appendChild(attachmentsContainer);
            }
        } else {
            console.log('没有附件需要处理');  // 调试日志
        }
    } else {
        messageContent.innerHTML = md.render(content);
        applyCodeHighlight(messageContent);
        
        // 为助手消息添加重新生成按钮
        const regenerateBtn = document.createElement('button');
        regenerateBtn.className = 'regenerate-btn';
        regenerateBtn.innerHTML = '🔄 重新生成';
        regenerateBtn.onclick = () => regenerateMessage(messageIndex);
        messageActions.appendChild(regenerateBtn);
        
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
    messageDiv.appendChild(messageWrapper);
    chatMessages.appendChild(messageDiv);
    
    if (shouldAutoScroll(chatMessages)) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// 在文件开头添加新的变量
let conversations = [];
let currentConversationId = null;

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

// 修改 createNewConversation 函数
async function createNewConversation() {
    // 如果有正在进行的流，先停止它
    if (currentReader) {
        await stopGeneration();
    }

    // 创建新对话前清理附件预览
    clearAttachmentPreview();

    // 检查当前对话是否为空对话
    if (currentConversationId) {
        const currentConversation = conversations.find(c => c.id === currentConversationId);
        if (currentConversation && currentConversation.messages.length === 0) {
            // 如果当前已经是一个空对话，就不需要创建新的
            return currentConversation;
        }
    }
    
    // 创建新对话，直接使用默认提示词
    const conversation = {
        id: Date.now().toString(),
        title: '新对话',
        messages: [],
        systemPrompt: default_system_prompt // 直接使用默认提示词
    };
    
    // 添加到对话列表
    conversations.unshift(conversation);
    currentConversationId = conversation.id;
    
    // 清空聊天界面
    chatMessages.innerHTML = '';
    
    // 重置消息数组，使用默认提示词
    messages = [
        {"role": "system", "content": default_system_prompt}
    ];
    
    // 更新系统提示词文本框
    const systemPromptTextarea = document.getElementById('system-prompt');
    systemPromptTextarea.value = default_system_prompt;
    
    // 保存并更新UI
    await saveConversations();
    renderConversationsList();
    
    return conversation;
}

// 修改 saveConversations 函数
async function saveConversations() {
    try {
        // 在保存前，确保当前对话的系统提示词是最新的
        if (currentConversationId) {
            const currentConversation = conversations.find(c => c.id === currentConversationId);
            if (currentConversation) {
                const systemPrompt = document.getElementById('system-prompt').value;
                currentConversation.systemPrompt = systemPrompt; // 不需要 trim，保持原样
            }
        }

        const response = await fetch('/api/conversations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ conversations })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '保存对话失败');
        }
        
        const data = await response.json();
        if(data.message === '保存成功') {
            showToast('保存成功');
            // 移除这行，避免重新加载覆盖当前状态
            // await loadConversations();
        }
        
        return true;
    } catch (error) {
        console.error('保存对话出错:', error);
        showToast(`保存失败: ${error.message}`, 'error');
        
        if (await confirmDialog('保存失败，是否重试？')) {
            return saveConversations();
        }
        
        return false;
    }
}

// 从数据库加载对话
async function loadConversations() {
    try {
        const response = await fetch('/api/conversations');
        if (!response.ok) {
            throw new Error('加载对话失败');
        }
        const data = await response.json();
        conversations = data.conversations || [];
        
        // 如果有当前对话，更新系统提示词
        if (currentConversationId) {
            const currentConversation = conversations.find(c => c.id === currentConversationId);
            if (currentConversation) {
                const systemPromptTextarea = document.getElementById('system-prompt');
                systemPromptTextarea.value = currentConversation.systemPrompt || default_system_prompt;
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
    // 如果有正在进行的流，先停止它
    if (currentReader) {
        await stopGeneration();
    }
    
    // 切换对话前清理附件预览
    clearAttachmentPreview();
    
    currentConversationId = conversationId;
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
        // 更新系统提示词
        const systemPromptTextarea = document.getElementById('system-prompt');
        systemPromptTextarea.value = conversation.hasOwnProperty('systemPrompt') ? 
            conversation.systemPrompt : default_system_prompt;
        
        clearChatMessages();
        messages = [
            {"role": "system", "content": conversation.systemPrompt || default_system_prompt}
        ];
        conversation.messages.forEach((msg, index) => {
            messages.push(msg);
            appendMessage(msg.content, msg.role === 'user', index, msg.attachments);
        });
        renderConversationsList();
        
        // 添加滚动到底部的逻辑
        const chatMessages = document.getElementById('chat-messages');
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
        
        try {
            await fetch(`/api/conversations/${conversationId}/switch`, {
                method: 'POST'
            });
        } catch (error) {
            console.error('切换对话出错:', error);
        }
    }
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
async function sendMessage() {
    const content = userInput.value.trim();
    if (!content && !hasAttachments()) return;

    // 获取选中的模型ID
    const modelSelect = document.getElementById('model-select');
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
    const currentConversation = conversations[0]; // 现在一定在第一位
    
    // 准备用户消息和附件
    const attachments = uploader.collectAttachments();
    console.log('收集到的附件:', attachments); // 调试日志
    
    const userMessage = {
        role: "user",
        content: content,
        attachments: attachments
    };

    // 添加用户消息到存储
    currentConversation.messages.push(userMessage);
    const userMessageIndex = currentConversation.messages.length - 1;
    
    // 添加用户消息到界面
    appendMessage(content, true, userMessageIndex, attachments);
    messages.push(userMessage);
    
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
    userInput.disabled = true;

    let assistantMessage = '';
    const messageIndex = currentConversation.messages.length;
    
    // 创建带有重新生成按钮的消息元素
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant-message';
    messageDiv.setAttribute('data-message-index', messageIndex);
    
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const messageActions = document.createElement('div');
    messageActions.className = 'message-actions';
    
    const regenerateBtn = document.createElement('button');
    regenerateBtn.className = 'regenerate-btn';
    regenerateBtn.innerHTML = '🔄 重新生成';
    regenerateBtn.onclick = () => regenerateMessage(messageIndex);
    
    messageActions.appendChild(regenerateBtn);
    messageWrapper.appendChild(messageContent);
    messageWrapper.appendChild(messageActions);
    messageDiv.appendChild(messageWrapper);
    chatMessages.appendChild(messageDiv);
    
    try {
        // 发送请求到服务器
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

        // 保存 reader 对象以便能够中断它
        const reader = response.body.getReader();
        currentReader = reader;
        const decoder = new TextDecoder();

        // 循环读取响应流
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
                        } catch (error) {
                            console.error('Error parsing SSE message:', error);
                            break;
                        }
                    }
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log('Stream was cancelled or closed');
                    break;
                }
                throw error;
            }
        }

        // 只有在成功接收到内容时才保存到消息历史
        if (assistantMessage.trim()) {
            currentConversation.messages.push({ role: "assistant", content: assistantMessage });
            await saveConversations();
        }
    } catch (error) {
        console.error('Error:', error);
        appendMessage('发生错误: ' + error.message, false);
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
        userInput.focus();
    }
}

// 添加删除对话的函数
async function deleteConversation(conversationId) {
    if (!confirm('确定要删除这个对话吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/conversations/${conversationId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('删除对话失败');
        }
        
        const index = conversations.findIndex(c => c.id === conversationId);
        if (index !== -1) {
            conversations.splice(index, 1);
            await saveConversations();
            
            if (conversationId === currentConversationId) {
                if (conversations.length > 0) {
                    await switchConversation(conversations[0].id);
                } else {
                    await createNewConversation();
                }
            } else {
                renderConversationsList();
            }
        }
    } catch (error) {
        console.error('删除对话出错:', error);
        alert('删除对话失败，请重试');
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
    await loadModels();
    
    // 初始化各种功能
    document.getElementById('new-chat-btn').addEventListener('click', createNewConversation);
    initializeDragAndDrop();
    initializePasteHandler();
    
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

// 修改加载模型列表的函数
async function loadModels() {
    try {
        const response = await fetch('/api/models');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const models = await response.json();
        if (!models || typeof models !== 'object') {
            throw new Error('无效的模型数据格式');
        }
        
        const select = document.getElementById('model-select');
        if (!select) {
            throw new Error('找不到模型选择器元素');
        }
        
        // 清空现有选项
        select.innerHTML = '<option value="" disabled selected>选择模型...</option>';
        
        // 添加模型组
        Object.entries(models).forEach(([provider, providerData]) => {
            if (providerData.models && Array.isArray(providerData.models) && providerData.models.length > 0) {
                const group = document.createElement('optgroup');
                group.label = `${provider.toUpperCase()} Models`;
                
                providerData.models.forEach(model => {
                    if (model && model.id && model.name) {
                        const option = document.createElement('option');
                        option.value = model.id;
                        option.textContent = `${model.name} - ${model.description || ''}`;
                        if (model.id === 'grok-2-vision-1212') {
                            option.selected = true;
                        }
                        group.appendChild(option);
                    }
                });
                
                if (group.children.length > 0) {
                    select.appendChild(group);
                }
            }
        });
        
        // 如果没有选中的模型，设置默认值
        if (!select.value) {
            select.value = 'grok-2-vision-1212';
        }
        
        // 如果没有任何可用模型，显示提示
        if (select.children.length <= 1) {
            throw new Error('没有可用的模型');
        }
    } catch (error) {
        console.error('获取模型列表失败:', error);
        const select = document.getElementById('model-select');
        if (select) {
            select.innerHTML = '<option value="grok-2-vision-1212" selected>Grok 2 Vision - 默认模型</option>';
        }
        showToast(`获取模型列表失败: ${error.message}`, 'error');
    }
}

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
            subsequentMessages: subsequentMessages  // 保存后续消息
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
    userInput.disabled = true;
    
    try {
        // 获取选中的模型ID
        const modelSelect = document.getElementById('model-select');
        const selectedModel = modelSelect.value;
        
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
                model_id: selectedModel
            })
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const reader = response.body.getReader();
        currentReader = reader;
        const decoder = new TextDecoder();
        
        let assistantMessage = '';
        
        // 获取当前消息元素
        const messageDiv = chatMessages.children[messageIndex];
        const messageContent = messageDiv.querySelector('.message-content');
        
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
                                messageContent.innerHTML = md.render('发生错误，请重试');
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
                        }
                    }
                }
            } catch (error) {
                if (error.name === 'AbortError' || error.name === 'CancelError') {
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
                subsequentMessages: []  // 新版本不包含任何后续消息
            };
            
            // 将新的版本添加到versions数组
            message.versions.push(newVersion);
            message.currentVersion = message.versions.length - 1;
            
            // 更新当前消息的内容和附件
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
            await saveConversations();
        }
    } catch (error) {
        console.error('Error:', error);
        messageContent.innerHTML = md.render('发生错误，请重试');
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
                    base64: attachment.base64,
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
                    getBase64Data: attachment.getBase64Data?.(),
                    getFileName: attachment.getFileName?.(),
                    getMimeType: attachment.getMimeType?.(),
                    getFilePath: attachment.getFilePath?.(),
                    getDuration: attachment.getDuration?.(),
                    getThumbnail: attachment.getThumbnail?.()
                });
                
                return {
                    type: attachment.type || (attachment.getMimeType?.()?.startsWith('video/') ? 'video' : 'image'),
                    base64: attachment.getBase64Data(),
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

            // 更新当前对话中的消息
            if (currentConversationId) {
                const currentConversation = conversations.find(c => c.id === currentConversationId);
                if (currentConversation && currentConversation.messages[messageIndex]) {
                    currentConversation.messages[messageIndex] = updatedMessage;
                    // 同步更新全局消息数组
                    messages = [
                        {"role": "system", "content": currentConversation.systemPrompt || default_system_prompt},
                        ...currentConversation.messages
                    ];
                }
            }
            
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
                for (const attachment of attachments) {
                    let renderedElement;
                    
                    if (attachment.base64) {
                        renderedElement = attachmentRenderer.render({
                            type: attachment.type || 'image',  // 使用附件的实际类型
                            base64: attachment.base64,
                            filename: attachment.fileName,
                            url: `data:${attachment.mime_type};base64,${attachment.base64}`,
                            disableDelete: true,
                            duration: attachment.duration,
                            thumbnail: attachment.thumbnail
                        });
                    } else if (attachment.file_path) {
                        renderedElement = attachmentRenderer.render({
                            type: attachment.type || 'image',  // 使用附件的实际类型
                            filename: attachment.fileName,
                            url: `/get_image?path=${encodeURIComponent(attachment.file_path)}`,
                            disableDelete: true,
                            duration: attachment.duration,
                            thumbnail: attachment.thumbnail
                        });
                    }
                    
                    if (renderedElement) {
                        attachmentsDiv.appendChild(renderedElement);
                    }
                }
            } else if (originalAttachmentsContainer) {
                originalAttachmentsContainer.remove();
            }
            
            // 保存对话
            await saveConversations();
            
            // 显示成功提示
            showToast('编辑已保存');
            
            // 移除编辑容器
            editContainer.remove();

            // 自动触发重新生成
            // 找到当前消息之后的第一个助手消息并重新生成
            const currentConversation = conversations.find(c => c.id === currentConversationId);
            if (currentConversation) {
                const conversationMessages = currentConversation.messages;
                for (let i = messageIndex + 1; i < conversationMessages.length; i++) {
                    if (conversationMessages[i].role === 'assistant') {
                        console.log('找到需要重新生成的助手消息，索引:', i);
                        await regenerateMessage(i);
                        break;
                    }
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
    message.content = selectedVersion.content;
    message.attachments = selectedVersion.attachments || [];
    
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
            appendMessage(msg.content, msg.role === 'user', absoluteIndex, msg.attachments);
        });
    }
    
    // 更新当前消息的UI
    const messageDiv = chatMessages.children[messageIndex];
    const messageContent = messageDiv.querySelector('.message-content');
    messageContent.innerHTML = md.render(message.content);
    applyCodeHighlight(messageContent);
    
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
            
            if (attachment.base64) {
                renderedElement = attachmentRenderer.render({
                    type: attachment.type || 'image',  // 使用附件的实际类型
                    base64: attachment.base64,
                    filename: attachment.fileName,
                    url: `data:${attachment.mime_type};base64,${attachment.base64}`,
                    disableDelete: true,
                    duration: attachment.duration,
                    thumbnail: attachment.thumbnail
                });
            } else if (attachment.file_path) {
                renderedElement = attachmentRenderer.render({
                    type: attachment.type || 'image',  // 使用附件的实际类型
                    filename: attachment.fileName,
                    url: `/get_image?path=${encodeURIComponent(attachment.file_path)}`,
                    disableDelete: true,
                    duration: attachment.duration,
                    thumbnail: attachment.thumbnail
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
    saveConversations();
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
                    await saveConversations();
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
            await saveConversations();
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
                await saveConversations();
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

