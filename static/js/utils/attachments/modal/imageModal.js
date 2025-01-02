/**
 * 创建图片预览模态框
 * @param {string} src 图片源地址
 */
export function createImageModal(src) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    
    // 创建关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close-btn';
    closeBtn.innerHTML = '×';
    
    // 创建图片容器
    const imageContainer = document.createElement('div');
    imageContainer.className = 'modal-image-container';
    
    // 创建图片元素
    const modalImg = document.createElement('img');
    modalImg.src = src;
    modalImg.className = 'modal-image';
    
    // 添加图片加载动画
    modalImg.style.opacity = '0';
    modalImg.onload = () => {
        modalImg.style.transition = 'opacity 0.3s ease-in-out';
        modalImg.style.opacity = '1';
    };
    
    // 组装模态框
    imageContainer.appendChild(modalImg);
    modal.appendChild(closeBtn);
    modal.appendChild(imageContainer);
    document.body.appendChild(modal);
    
    // 处理关闭事件
    const closeModal = () => {
        modal.classList.add('modal-closing');
        setTimeout(() => modal.remove(), 300); // 等待动画完成后移除
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
    document.body.style.overflow = 'hidden';
    modal.addEventListener('remove', () => {
        document.body.style.overflow = '';
    });
}