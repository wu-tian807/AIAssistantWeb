import { AttachmentType } from './types.js';
import { createImageModal } from './modal/imageModal.js';

export class AttachmentRenderer {
    constructor() {
        // 注册不同类型附件的渲染器
        this.renderers = {
            [AttachmentType.IMAGE]: this.renderImagePreview.bind(this),
            [AttachmentType.DOCUMENT]: this.renderDocumentPreview.bind(this),
            [AttachmentType.BINARY]: this.renderBinaryPreview.bind(this)
        };
    }

    /**
     * 渲染附件预览
     * @param {Object} attachment 附件对象
     * @returns {HTMLElement} 渲染后的预览元素
     */
    render(attachment) {
        const renderer = this.renderers[attachment.type];
        if (!renderer) {
            console.warn(`未找到类型 ${attachment.type} 的渲染器`);
            return null;
        }
        return renderer(attachment);
    }

    /**
     * 渲染图片预览
     * @param {Object} attachment 图片附件对象
     * @returns {HTMLElement} 图片预览元素
     */
    renderImagePreview(attachment) {
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

    /**
     * 渲染文档预览（预留）
     * @param {Object} attachment 文档附件对象
     * @returns {HTMLElement} 文档预览元素
     */
    renderDocumentPreview(attachment) {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item document-preview-item';
        
        // 创建文档图标
        const icon = document.createElement('div');
        icon.className = 'document-icon';
        icon.innerHTML = '📄'; // 使用临时图标，后续可替换为自定义图标
        
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
        previewItem.appendChild(icon);
        previewItem.appendChild(fileName);
        
        return previewItem;
    }

    /**
     * 渲染二进制文件预览（预留）
     * @param {Object} attachment 二进制附件对象
     * @returns {HTMLElement} 二进制文件预览元素
     */
    renderBinaryPreview(attachment) {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item binary-preview-item';
        
        // 创建二进制文件图标
        const icon = document.createElement('div');
        icon.className = 'binary-icon';
        icon.innerHTML = '📦'; // 使用临时图标，后续可替换为自定义图标
        
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
        previewItem.appendChild(icon);
        previewItem.appendChild(fileName);
        
        return previewItem;
    }
}