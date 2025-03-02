import { initMarkdownit } from "./utils/markdownit.js";
class MessageManager {

    constructor(chatMessages,userInput,sendButton,attachmentPreview,uploader,modelSelect){
        this.chatMessages = chatMessages;
        this.userInput = userInput;
        this.sendButton = sendButton;
        this.attachmentPreview = attachmentPreview;
        this.uploader = uploader;
        this.modelSelect = modelSelect;
    }
    hasAttachments(){
        return this.uploader.getAttachments().length > 0;
    }
    // 检查是否可以发送消息的函数
    canSendMessage() {
        const hasText = this.userInput.value.trim().length > 0;
        const hasAttachments = this.attachmentPreview && this.attachmentPreview.children.length > 0;
        const stopStatus = this.sendButton.classList.contains('stop');
        // 新增最后一条消息检查
        const lastMessage = this.chatMessages.lastElementChild;
        const isPendingAssistant = lastMessage?.classList.contains('assistant-message') && 
                              !lastMessage.classList.contains('error-message');
        // 如果处于停止状态，总是返回 true
        return (stopStatus || hasText || hasAttachments) && !isPendingAssistant;
    }
    //重置滚动状态，并设置全局状态（window.isGenerating）为正在生成内容。
    setState(){
        //设置和恢复状态
        this.userInput.disabled = true;
        this.sendButton.disabled = true;
        this.sendButton.classList.add('stop');
        // 重置滚动状态，确保新消息可以自动滚动
        window.resetScrollState();

        // 设置内容生成状态为true
        window.isGenerating = true;
    }

    resetState(){
        //恢复状态
        this.userInput.disabled = false;
        this.sendButton.disabled = false;
        this.sendButton.classList.remove('stop');
        window.isGenerating = false;
    }

    resetInput(){
        // 清空输入框并重置高度
        this.userInput.value = '';
        this.userInput.style.height = 'auto'; // 重置输入框高度
    }

    prepareMessage(currentConversationId,conversations){

    }
        

    async sendMessage(retryCount=1,delay=1000,currentConversationId,conversations){
        this.canSendMessage();

        this.resetState();

        try {
            let error = false;
            const content = this.userInput.value.trim();
            const md = initMarkdownit(); // 确保md对象被正确初始化
    
            if (!content && !this.hasAttachments()) return;
    
            // 获取选中的模型ID和类型
            const selectedOption = this.modelSelect.options[this.modelSelect.selectedIndex];
            const modelIcon = selectedOption.getAttribute('data-model-icon');
            const modelSettings = window.modelSettingRenderer.getSettings();//在script.js中定义
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
                const scriptModule = await import('./script.js');
                await scriptModule.createNewConversation();
            }

            // 将当前对话移动到列表顶部
            const currentIndex = conversations.findIndex(c => c.id === currentConversationId);
            if (currentIndex > 0) {
                const [conversation] = conversations.splice(currentIndex, 1);
                conversations.unshift(conversation);
                const scriptModule = await import('./script.js');
                await scriptModule.renderConversationsList();
            }

            // 获取当前对话
            const currentConversation = conversations[0];
            
            // 准备用户消息和附件
            const attachments = this.uploader.collectAttachments();
            const userMessage = {
                role: "user",
                content: content,
                attachments: attachments
            };

            // 添加用户消息到存储和界面
            currentConversation.messages.push(userMessage);
            const userMessageIndex = currentConversation.messages.length - 1;
            const scriptModule = await import('./script.js');
            await scriptModule.appendMessage(content, true, userMessageIndex, attachments, error);


            

        }
        catch(e){
            
        }


    }
    
}

