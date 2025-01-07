/**
 * 显示提示信息
 * @param {string} message - 提示消息
 * @param {string} type - 提示类型 ('success' | 'error' | 'info' | 'warning')
 * @param {number} duration - 持续时间(毫秒)，0表示不自动消失
 * @returns {HTMLElement} toast元素
 */
export function showToast(message, type = 'success', duration = 3000) {
    // 创建提示元素
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // 如果是持久化的toast，添加关闭按钮
    if (duration === 0) {
        toast.className += ' persistent';
        
        // 创建消息容器
        const messageDiv = document.createElement('div');
        messageDiv.className = 'toast-message';
        messageDiv.textContent = message;
        
        // 创建关闭按钮
        const closeButton = document.createElement('button');
        closeButton.className = 'toast-close';
        closeButton.innerHTML = '×';
        closeButton.onclick = () => toast.remove();
        
        toast.appendChild(messageDiv);
        toast.appendChild(closeButton);
    } else {
        toast.textContent = message;
        // 设置定时器自动消失
        setTimeout(() => {
            toast.remove();
        }, duration);
    }
    
    // 添加到页面
    document.body.appendChild(toast);
    
    return toast;
}

// 确认对话框
export function confirmDialog(message) {
    return new Promise((resolve) => {
        const result = confirm(message);
        resolve(result);
    });
} 

// 在文件开头添加这个函数
export function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}