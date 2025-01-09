import { TextModal } from '../modal/TextModal.js';

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
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item text-preview-item';
        
        // 创建文本图标
        const icon = document.createElement('div');
        icon.className = 'text-icon';
        icon.innerHTML = '📝'; // 使用临时图标，后续可替换为自定义图标
        
        // 创建文件信息容器
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        
        // 创建文件名显示
        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = attachment.fileName;
        
        // 创建文件预览信息
        const previewInfo = document.createElement('div');
        previewInfo.className = 'preview-info';
        previewInfo.textContent = `${attachment.lineCount || '未知'} 行 | ${attachment.encoding || 'UTF-8'}`;
        
        // 组装文件信息
        fileInfo.appendChild(fileName);
        fileInfo.appendChild(previewInfo);
        
        // 创建预览按钮
        const previewButton = document.createElement('button');
        previewButton.className = 'preview-button btn btn-sm btn-outline-primary';
        previewButton.textContent = '预览';
        previewButton.onclick = () => this.modal.show(attachment);
        
        // 创建操作按钮容器
        const actions = document.createElement('div');
        actions.className = 'actions';
        actions.appendChild(previewButton);
        
        // 只在未禁用删除按钮时创建删除按钮
        if (!attachment.disableDelete) {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button btn btn-sm btn-outline-danger ms-2';
            deleteButton.textContent = '删除';
            deleteButton.onclick = () => previewItem.remove();
            actions.appendChild(deleteButton);
        }
        
        // 组装预览项
        previewItem.appendChild(icon);
        previewItem.appendChild(fileInfo);
        previewItem.appendChild(actions);
        
        // 添加点击预览功能
        previewItem.addEventListener('click', (e) => {
            // 如果点击的不是按钮，则触发预览
            if (!e.target.closest('button')) {
                this.modal.show(attachment);
            }
        });
        
        return previewItem;
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
