const textarea = document.getElementById('user-input');
function adjustTextareaHeight(textarea) {
    // 重置高度
    textarea.style.height = 'auto';
    
    // 计算新高度（加上一点额外空间防止出现滚动条）
    const newHeight = textarea.scrollHeight + 2;
    
    // 限制最大高度
    const maxHeight = 200;
    
    // 设置新高度
    textarea.style.height = `${Math.min(newHeight, maxHeight)}px`;
}

// 在输入框的input事件中调用
textarea.addEventListener('input', (e) => {
    adjustTextareaHeight(e.target);
});

// 在初始化时也调用一次
adjustTextareaHeight(textarea);