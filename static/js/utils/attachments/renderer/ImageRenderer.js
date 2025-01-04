import { createImageModal } from '../modal/imageModal.js';

export class ImageRenderer {
    /**
     * 渲染图片预览
     * @param {Object} attachment 图片附件对象
     * @returns {HTMLElement} 图片预览元素
     */
    render(attachment) {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item image-preview-item';
        
        // 创建图片容器
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container';
        
        // 创建图片元素
        const img = document.createElement('img');
        img.src = attachment.url || `data:image/jpeg;base64,${attachment.base64}`;
        img.alt = attachment.filename;
        img.className = 'preview-image';
        
        // 添加图片点击预览功能
        img.onclick = () => createImageModal(img.src);
        
        // 创建文件名显示
        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = attachment.filename;
        
        // 只在未禁用删除按钮时创建删除按钮
        if (!attachment.disableDelete) {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.innerHTML = '×';
            deleteButton.onclick = () => previewItem.remove();
            previewItem.appendChild(deleteButton);
        }
        
        // 组装预览项
        imageContainer.appendChild(img);
        previewItem.appendChild(imageContainer);
        previewItem.appendChild(fileName);
        
        return previewItem;
    }
} 