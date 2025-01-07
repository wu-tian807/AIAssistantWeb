/**
 * 上传状态管理器
 */
class UploadStatusManager {
    constructor() {
        this.messageContainer = document.getElementById('chat-messages');
        this.currentStatusMessage = null;
    }

    /**
     * 显示上传开始状态
     * @param {string} fileName - 文件名
     * @param {number} fileSize - 文件大小（字节）
     */
    showUploadStart(fileName, fileSize) {
        const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        const message = `正在上传视频到Gemini服务器，请稍候...\n文件名: ${fileName}\n大小: ${sizeMB}MB`;
        this.updateStatus(message, 'uploading');
    }

    /**
     * 显示上传成功状态
     * @param {string} [message] - 可选的成功消息
     */
    showUploadSuccess(message = '上传成功！') {
        this.updateStatus(message, 'success');
        // 1.5秒后清除消息
        setTimeout(() => this.clear(), 1500);
    }

    /**
     * 显示上传错误状态
     * @param {string} error - 错误信息
     */
    showUploadError(error) {
        const message = `上传失败: ${error}`;
        this.updateStatus(message, 'error');
        // 3秒后清除错误消息
        setTimeout(() => this.clear(), 3000);
    }

    /**
     * 创建或更新状态消息
     * @param {string} message - 状态消息
     * @param {string} type - 消息类型 ('uploading' | 'success' | 'error')
     */
    updateStatus(message, type = 'uploading') {
        if (!this.currentStatusMessage) {
            // 创建新的状态消息元素
            this.currentStatusMessage = document.createElement('div');
            this.currentStatusMessage.className = 'message assistant-message status-message';
            
            const messageWrapper = document.createElement('div');
            messageWrapper.className = 'message-wrapper';
            
            const messageContent = document.createElement('div');
            messageContent.className = 'message-content';
            
            messageWrapper.appendChild(messageContent);
            this.currentStatusMessage.appendChild(messageWrapper);
            
            // 插入到最后一条消息之前
            const lastMessage = this.messageContainer.lastElementChild;
            if (lastMessage) {
                this.messageContainer.insertBefore(this.currentStatusMessage, lastMessage);
            } else {
                this.messageContainer.appendChild(this.currentStatusMessage);
            }
        }

        // 获取消息内容元素
        const messageContent = this.currentStatusMessage.querySelector('.message-content');

        // 根据类型设置样式和图标
        let icon = '⏳';
        if (type === 'success') {
            icon = '✅';
            this.currentStatusMessage.classList.add('success');
            this.currentStatusMessage.classList.remove('error', 'uploading');
        } else if (type === 'error') {
            icon = '❌';
            this.currentStatusMessage.classList.add('error');
            this.currentStatusMessage.classList.remove('success', 'uploading');
        } else {
            this.currentStatusMessage.classList.add('uploading');
            this.currentStatusMessage.classList.remove('success', 'error');
        }

        // 更新消息内容
        messageContent.innerHTML = `${icon} ${message}`;

        // 滚动到底部
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }

    /**
     * 清除状态消息
     */
    clear() {
        if (this.currentStatusMessage) {
            // 添加淡出动画
            this.currentStatusMessage.style.opacity = '0';
            setTimeout(() => {
                this.currentStatusMessage.remove();
                this.currentStatusMessage = null;
            }, 300);
        }
    }
}

// 创建全局实例
window.uploadStatusManager = new UploadStatusManager(); 