import { AttachmentType } from '../types.js';
import { createImageModal } from '../modal/imageModal.js';

export class ImageRenderer {
    /**
     * 渲染图片预览
     * @param {Object} attachment 图片附件对象
     * @returns {Promise<HTMLElement>} 图片预览元素
     */
    async render(attachment) {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item image-preview-item';
        
        // 创建图片元素
        const img = document.createElement('img');
        img.className = 'preview-image';
        img.alt = attachment.filename || '图片';
        
        // 设置默认图片
        img.src = '/static/images/loading.gif';
        
        // 如果有 base64_id，获取图片数据
        if (attachment.base64_id) {
            try {
                const response = await fetch(`/api/image/base64/${attachment.base64_id}`);
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('图片加载失败:', {
                        status: response.status,
                        statusText: response.statusText,
                        error: errorData
                    });
                    
                    // 获取调试信息
                    const debugResponse = await fetch(`/api/image/debug/base64/${attachment.base64_id}`);
                    const debugData = await debugResponse.json();
                    console.error('认证调试信息:', debugData);
                    
                    // 获取文件系统状态
                    const fsResponse = await fetch(`/api/image/debug/file_check/${attachment.base64_id}`);
                    const fsData = await fsResponse.json();
                    console.error('文件系统状态:', fsData);
                    
                    // 如果是认证问题，重定向到登录页面
                    if (debugData.is_authenticated === false) {
                        window.location.href = '/login';
                        return;
                    }
                    
                    // 根据错误类型显示不同的错误信息
                    switch (errorData.type) {
                        case 'file_not_found':
                            console.error('图片文件不存在:', errorData.error);
                            break;
                        case 'invalid_data':
                            console.error('图片数据无效:', errorData.error);
                            break;
                        case 'json_error':
                            console.error('JSON解析错误:', errorData.error);
                            break;
                        default:
                            console.error('未知错误:', errorData.error);
                    }
                    
                    img.src = '/static/images/error.png';
                    return;
                }
                
                const data = await response.json();
                if (data.base64) {
                    img.src = `data:${attachment.mime_type || 'image/jpeg'};base64,${data.base64}`;
                } else {
                    console.error('响应中没有base64数据');
                    img.src = '/static/images/error.png';
                }
            } catch (error) {
                console.error('获取图片数据时发生错误:', error);
                img.src = '/static/images/error.png';
            }
        } else if (attachment.file_path) {
            img.src = `/get_image?path=${encodeURIComponent(attachment.file_path)}`;
        }
        
        // 添加点击图片打开模态框的功能
        img.style.cursor = 'pointer';
        img.onclick = (e) => {
            e.stopPropagation();
            createImageModal(img.src);
        };
        
        // 创建文件名显示
        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = attachment.filename || '未命名图片';
        
        // 设置删除按钮的显示状态
        previewItem.setAttribute('data-disable-delete', attachment.disableDelete ? 'true' : 'false');
        
        // 组装预览项
        previewItem.appendChild(img);
        previewItem.appendChild(fileName);
        
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
        
        return previewItem;
    }
}

// 导出单例实例
export const imageRenderer = new ImageRenderer(); 