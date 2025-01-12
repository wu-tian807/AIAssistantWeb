import { TextModal } from '../modal/TextModal.js';
import { showToast } from '../../toast.js';

/**
 * 文本附件渲染器
 */
export class TextRenderer {
    constructor() {
        this.modal = new TextModal();
    }

    /**
     * 渲染文本附件
     * @param {Object} attachment 文本附件对象
     * @returns {HTMLElement} 渲染后的预览元素
     */
    render(attachment) {
        try {
            const previewItem = document.createElement('div');
            previewItem.className = 'text-attachment-preview';
            
            // 如果有错误，显示错误状态
            if (attachment.error) {
                previewItem.classList.add('error');
                
                // 创建错误图标
                const iconContainer = document.createElement('div');
                iconContainer.className = 'text-icon error';
                iconContainer.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
                
                // 创建错误信息容器
                const errorInfo = document.createElement('div');
                errorInfo.className = 'text-info';
                
                // 创建文件名
                const fileName = document.createElement('div');
                fileName.className = 'file-name';
                fileName.textContent = attachment.fileName || '未命名文本';
                
                // 创建错误信息
                const errorDetails = document.createElement('div');
                errorDetails.className = 'file-details error';
                errorDetails.textContent = '文件处理失败';
                
                // 组装错误信息
                errorInfo.appendChild(fileName);
                errorInfo.appendChild(errorDetails);
                
                // 组装预览项
                previewItem.appendChild(iconContainer);
                previewItem.appendChild(errorInfo);
                
                // 显示错误提示
                showToast('文件处理失败：' + (attachment.error.message || '未知错误'), 'error');
                
                return previewItem;
            }
            
            // 创建文本图标容器
            const iconContainer = document.createElement('div');
            iconContainer.className = 'text-icon';
            iconContainer.innerHTML = '<i class="fas fa-file-alt"></i>';
            
            // 创建文本信息容器
            const textInfo = document.createElement('div');
            textInfo.className = 'text-info';
            
            // 创建文件名
            const fileName = document.createElement('div');
            fileName.className = 'file-name';
            fileName.textContent = attachment.fileName || '未命名文本';
            
            // 创建文件详情
            const fileDetails = document.createElement('div');
            fileDetails.className = 'file-details';
            fileDetails.textContent = `${attachment.lineCount || '0'} 行 | ${attachment.encoding || 'UTF-8'}`;
            
            // 组装文本信息
            textInfo.appendChild(fileName);
            textInfo.appendChild(fileDetails);
            
            // 只在未禁用删除按钮时创建删除按钮
            if (!attachment.disableDelete) {
                const deleteButton = document.createElement('button');
                deleteButton.className = 'delete-button';
                deleteButton.innerHTML = '×';
                deleteButton.onclick = (e) => {
                    e.stopPropagation();
                    if (typeof attachment.onDelete === 'function') {
                        attachment.onDelete();
                    }
                    previewItem.remove();
                };
                previewItem.appendChild(deleteButton);
            }
            
            // 添加点击事件打开预览
            if (!attachment.error) {
                previewItem.onclick = async () => {
                    try {
                        // 确保每次都创建新的模态框实例
                        const modal = new TextModal();
                        await modal.show(attachment);
                    } catch (error) {
                        console.error('打开预览失败:', error);
                        showToast('打开预览失败: ' + error.message, 'error');
                    }
                };
            }
            
            // 组装预览项
            previewItem.appendChild(iconContainer);
            previewItem.appendChild(textInfo);
            
            return previewItem;
        } catch (error) {
            console.error('渲染文本预览失败:', error);
            const errorElement = document.createElement('div');
            errorElement.className = 'text-attachment-preview error';
            errorElement.innerHTML = `
                <div class="text-icon error">
                    <i class="fas fa-exclamation-circle"></i>
                </div>
                <div class="text-info">
                    <div class="file-name">渲染失败</div>
                    <div class="file-details error">预览加载失败</div>
                </div>
            `;
            showToast('预览加载失败：' + error.message, 'error');
            return errorElement;
        }
    }

    /**
     * 销毁渲染器
     */
    dispose() {
        if (this.modal) {
            this.modal.dispose();
            this.modal = null;
        }
    }
}

// 导出单例实例
export const textRenderer = new TextRenderer();
