import { AttachmentType } from './types.js';
import { ImageRenderer } from './renderer/ImageRenderer.js';
import { VideoRenderer } from './renderer/VideoRenderer.js';

export class AttachmentRenderer {
    constructor() {
        // 注册不同类型附件的渲染器
        this.renderers = {
            [AttachmentType.IMAGE]: new ImageRenderer(),
            [AttachmentType.VIDEO]: new VideoRenderer(),
            [AttachmentType.DOCUMENT]: this.renderDocumentPreview.bind(this),
            [AttachmentType.BINARY]: this.renderBinaryPreview.bind(this)
        };
        this.container = null;
    }

    /**
     * 设置预览容器
     * @param {HTMLElement} container 预览容器元素
     */
    setContainer(container) {
        this.container = container;
    }

    /**
     * 清理所有附件预览
     */
    clearAll() {
        if (this.container) {
            while (this.container.firstChild) {
                this.container.removeChild(this.container.firstChild);
            }
        }
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
        
        // 确保传递 disableDelete 属性
        const rendererAttachment = {
            ...attachment,
            disableDelete: attachment.disableDelete || false
        };
        
        return renderer.render ? 
            renderer.render(rendererAttachment) : 
            renderer(rendererAttachment);
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