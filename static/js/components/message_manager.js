class MessageManager {

    constructor(chatMessages,userInput,sendButton,attachmentPreview){
        this.chatMessages = chatMessages;
        this.userInput = userInput;
        this.sendButton = sendButton;
        this.attachmentPreview = attachmentPreview;
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
    async resetState(){
        //设置和恢复状态
        if (sendButton.classList.contains('stop')) {
            sendButton.disabled = false;
        }
    }
    
}

