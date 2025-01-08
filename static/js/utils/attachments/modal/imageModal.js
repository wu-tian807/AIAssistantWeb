/**
 * 创建图片预览模态框
 * @param {string} src 图片源地址
 */
export function createImageModal(src) {
    // 防止重复创建
    const existingModal = document.querySelector('.image-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'image-modal';
    
    // 创建关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close-btn';
    closeBtn.innerHTML = '×';
    
    // 创建图片容器
    const imageContainer = document.createElement('div');
    imageContainer.className = 'modal-image-container';
    
    // 创建加载指示器
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = '加载中...';
    imageContainer.appendChild(loadingIndicator);
    
    // 创建图片元素
    const modalImg = document.createElement('img');
    modalImg.className = 'modal-image';
    modalImg.alt = '预览图片';
    
    // 处理图片加载
    modalImg.onload = () => {
        loadingIndicator.remove();
        modalImg.style.opacity = '1';
    };
    
    modalImg.onerror = () => {
        loadingIndicator.innerHTML = '图片加载失败';
        loadingIndicator.style.color = '#ff4444';
    };
    
    // 设置图片源
    modalImg.src = src;
    
    // 组装模态框
    imageContainer.appendChild(modalImg);
    modal.appendChild(closeBtn);
    modal.appendChild(imageContainer);
    
    // 处理关闭事件
    const closeModal = () => {
        modal.classList.add('modal-closing');
        document.body.classList.remove('modal-open');
        setTimeout(() => {
            modal.remove();
        }, 300);
    };
    
    // 点击关闭按钮关闭
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeModal();
    };
    
    // 点击模态框背景关闭
    modal.onclick = (e) => {
        if (e.target === modal || e.target === imageContainer) {
            closeModal();
        }
    };
    
    // 按 ESC 键关闭
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleKeyDown);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
    
    // 防止滚动穿透
    document.body.classList.add('modal-open');
    
    // 添加到页面
    document.body.appendChild(modal);
    
    // 自动聚焦到关闭按钮，方便键盘操作
    closeBtn.focus();
    
    return modal;
}