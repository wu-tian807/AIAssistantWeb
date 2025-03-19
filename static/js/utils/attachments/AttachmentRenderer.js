import { AttachmentType } from './types.js';
import { ImageRenderer } from './renderer/ImageRenderer.js';
import { VideoRenderer } from './renderer/VideoRenderer.js';
import { TextRenderer } from './renderer/TextRenderer.js';

export class AttachmentRenderer {
    constructor() {
        // 注册不同类型附件的渲染器
        this.renderers = {
            [AttachmentType.IMAGE]: new ImageRenderer(),
            [AttachmentType.VIDEO]: new VideoRenderer(),
            [AttachmentType.TEXT]: new TextRenderer(),
            [AttachmentType.DOCUMENT]: this.renderDocumentPreview.bind(this),
            [AttachmentType.BINARY]: this.renderBinaryPreview.bind(this)
        };
        this.container = null;
        this.attachmentCount = 0; // 添加附件计数器
    }

    /**
     * 设置预览容器
     * @param {HTMLElement} container 预览容器元素
     */
    setContainer(container) {
        this.container = container;
        // 初始状态下隐藏容器
        this.updateContainerVisibility();
    }

    /**
     * 根据附件数量更新容器可见性
     */
    updateContainerVisibility() {
        if (!this.container) return;
        
        if (this.attachmentCount > 0) {
            this.container.style.display = ''; // 恢复默认显示
        } else {
            this.container.style.display = 'none'; // 隐藏容器
        }
    }

    /**
     * 清理所有附件预览
     */
    clearAll() {
        if (this.container) {
            while (this.container.firstChild) {
                this.container.removeChild(this.container.firstChild);
            }
            // 重置计数器并更新容器可见性
            this.attachmentCount = 0;
            this.updateContainerVisibility();
        }
    }

    /**
     * 添加附件到容器
     * @param {HTMLElement} element 附件元素
     */
    addAttachmentToContainer(element) {
        if (this.container && element) {
            this.container.appendChild(element);
            this.attachmentCount++;
            this.updateContainerVisibility();
            
            // 为元素添加删除事件监听，以便在删除时更新计数
            const deleteButton = element.querySelector('.delete-button');
            if (deleteButton) {
                const originalOnClick = deleteButton.onclick;
                deleteButton.onclick = (e) => {
                    if (originalOnClick) originalOnClick(e);
                    this.attachmentCount--;
                    this.updateContainerVisibility();
                };
            }
        }
    }

    /**
     * 渲染附件预览
     * @param {Object} attachment 附件对象
     * @returns {Promise<HTMLElement>} 渲染后的预览元素
     */
    async render(attachment) {
        try {
            // 判断附件类型
            const type = attachment.type || this.getAttachmentType(attachment);
            if (!type) {
                return this.createErrorElement('未知的附件类型');
            }
            
            console.log(`渲染${type}类型附件:`, attachment);
            
            // 确保渲染器存在
            const renderer = this.renderers[type];
            if (!renderer) {
                console.warn(`未找到${type}类型的渲染器`);
                return this.createErrorElement(`不支持的附件类型: ${type}`);
            }
            
            // 对文本附件进行特殊处理
            if (type === AttachmentType.TEXT) {
                console.log('处理文本附件:', attachment);
                // 确保传递所有必要的文本附件属性
                const textAttachment = {
                    ...attachment,
                    type: AttachmentType.TEXT,
                    fileName: attachment.fileName || attachment.filename,
                    mime_type: attachment.mime_type,
                    content_id: attachment.content_id,
                    encoding: attachment.encoding || 'UTF-8',
                    lineCount: attachment.lineCount || 0,
                    size: attachment.size || 0,
                    disableDelete: attachment.disableDelete || false
                };
                
                return await renderer.render(textAttachment);
            }
            
            // 渲染其他类型附件
            let element;
            try {
                if (renderer.render && typeof renderer.render === 'function') {
                    element = await renderer.render(attachment);
                } else {
                    element = renderer(attachment);
                }
                
                if (!element || !(element instanceof HTMLElement)) {
                    console.error('渲染器返回了无效的元素:', element);
                    return this.createErrorElement('渲染失败');
                }
                
                this.addAttachmentToContainer(element);
                return element;
            } catch (error) {
                console.error(`渲染${type}附件失败:`, error);
                return this.createErrorElement(`渲染${type}附件失败: ${error.message}`);
            }
        } catch (error) {
            console.error('渲染附件失败:', error);
            return this.createErrorElement('渲染失败: ' + error.message);
        }
    }

    /**
     * 创建错误提示元素
     * @param {string} message 错误信息
     * @returns {HTMLElement} 错误提示元素
     */
    createErrorElement(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'preview-item error';
        errorElement.textContent = message;
        return errorElement;
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
            deleteButton.onclick = () => {
                previewItem.remove();
                // 更新附件计数并检查可见性
                this.attachmentCount--;
                this.updateContainerVisibility();
            };
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
            deleteButton.onclick = () => {
                previewItem.remove();
                // 更新附件计数并检查可见性
                this.attachmentCount--;
                this.updateContainerVisibility();
            };
            previewItem.appendChild(deleteButton);
        }
        
        // 组装预览项
        previewItem.appendChild(icon);
        previewItem.appendChild(fileName);
        
        return previewItem;
    }

    /**
     * 直接添加外部创建的预览元素
     * @param {HTMLElement} element 预览元素
     */
    addExternalElement(element) {
        if (!element || !(element instanceof HTMLElement)) {
            console.error('无效的预览元素');
            return;
        }
        
        this.addAttachmentToContainer(element);
        
        // 查找并修改删除按钮的事件处理
        const deleteButton = element.querySelector('.delete-button');
        if (deleteButton) {
            const originalOnClick = deleteButton.onclick;
            deleteButton.onclick = (e) => {
                if (originalOnClick) originalOnClick(e);
                // 确保计数器减少并更新容器可见性
                this.attachmentCount--;
                this.updateContainerVisibility();
            };
        }
        
        return element;
    }

    /**
     * 根据附件属性推断类型
     * @param {Object} attachment 附件对象
     * @returns {string|null} 附件类型
     * @private
     */
    getAttachmentType(attachment) {
        if (!attachment) return null;
        
        if (attachment.type) return attachment.type;
        
        // 根据特定属性推断类型
        if (attachment.base64_id || attachment.base64) return 'image';
        if (attachment.content_id) return 'text';
        if (attachment.duration || (attachment.mime_type && attachment.mime_type.startsWith('video/'))) return 'video';
        
        // 根据MIME类型推断
        if (attachment.mime_type) {
            if (attachment.mime_type.startsWith('image/')) return 'image';
            if (attachment.mime_type.startsWith('text/')) return 'text';
            if (attachment.mime_type.startsWith('video/')) return 'video';
            if (attachment.mime_type.startsWith('audio/')) return 'audio';
        }
        
        // 根据文件扩展名推断
        if (attachment.fileName || attachment.filename) {
            const fileName = attachment.fileName || attachment.filename;
            const ext = fileName.split('.').pop().toLowerCase();
            
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
            if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(ext)) return 'video';
            if (['mp3', 'wav', 'ogg', 'aac'].includes(ext)) return 'audio';
            if (['txt', 'md', 'js', 'css', 'html', 'json', 'xml', 'csv'].includes(ext)) return 'text';
        }
        
        return null;
    }
}