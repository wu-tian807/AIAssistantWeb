import { TextAttachment } from '../attachment/TextAttachment.js';
import { showToast } from '../../toast.js';

/**
 * 文本文件上传器
 */
export class TextUploader {
    constructor(options = {}) {
        this.options = options;
        this.attachments = new Set();
    }

    /**
     * 处理文件选择
     * @param {File} file - 选择的文件
     * @returns {Promise<TextAttachment>}
     */
    async handleFileSelect(file) {
        try {
            if (!file) {
                console.warn('没有选择文件');
                throw new Error('没有选择文件');
            }
            
            console.log('TextUploader处理文件:', file.name, '类型:', file.type, '大小:', file.size);
            
            // 验证文件类型
            if (!this.validateFile(file)) {
                throw new Error('文件类型不支持');
            }
            
            // 显示上传中提示
            const uploadingToast = showToast('文本文件上传中...', 'info', 0);
            
            try {
                // 使用FormData直接上传文件，不再使用base64处理
                const formData = new FormData();
                formData.append('file', file);
                formData.append('fileName', file.name);
                
                // 获取CSRF令牌
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
                console.log('CSRF令牌:', csrfToken ? '已获取' : '未找到');
                
                // 发送请求到新的上传端点
                console.log('开始上传文件...');
                const response = await fetch('/api/text/upload', {
                    method: 'POST',
                    headers: {
                        'X-CSRF-Token': csrfToken
                    },
                    body: formData
                });
                
                console.log('收到后端响应:', response.status, response.statusText);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(e => {
                        console.error('解析错误响应失败:', e);
                        return { error: '无法解析错误响应' };
                    });
                    console.error('上传文本失败，服务器响应:', errorData);
                    throw new Error(errorData.error || `上传文本失败 (${response.status})`);
                }
                
                const responseData = await response.json();
                console.log('上传成功，服务器返回:', responseData);
                
                // 移除上传中提示
                if (uploadingToast) {
                    uploadingToast.remove();
                }
                
                // 显示上传成功提示
                showToast('文本文件上传成功', 'success');
                
                // 创建文本附件对象
                const textAttachment = new TextAttachment({
                    fileName: file.name,
                    mime_type: file.type || 'text/plain',
                    content_id: responseData.metadata.content_id,
                    encoding: responseData.metadata.encoding || 'UTF-8',
                    lineCount: responseData.metadata.line_count || 0,
                    size: file.size,
                    lastModified: file.lastModified
                });
                
                console.log('创建文本附件对象:', textAttachment);
                
                // 保存到附件集合
                this.attachments.add(textAttachment);
                
                // 调用上传成功回调
                if (this.options.onUploadSuccess) {
                    this.options.onUploadSuccess(textAttachment);
                }
                
                return textAttachment;
            } catch (error) {
                // 确保在发生错误时移除上传中提示
                if (uploadingToast) {
                    uploadingToast.remove();
                }
                // 显示错误提示
                showToast(`文本上传失败: ${error.message}`, 'error');
                throw error;
            }
        } catch (error) {
            console.error('处理文件选择失败:', error);
            throw error;
        }
    }

    /**
     * 读取文件内容
     * @param {File} file - 文件对象
     * @returns {Promise<string>} 返回Base64编码的文件内容
     * @private
     */
    async readFileContent(file) {
        console.log('开始读取文件内容:', file.name);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    console.log('文件内容加载完成, 结果类型:', typeof e.target.result);
                    
                    // 验证结果是否为DataURL格式
                    if (typeof e.target.result !== 'string' || !e.target.result.startsWith('data:')) {
                        console.error('读取结果不是有效的DataURL:', e.target.result.substring(0, 50) + '...');
                        reject(new Error('文件内容格式无效'));
                        return;
                    }
                    
                    // readAsDataURL返回的格式是 data:mime/type;base64,BASE64_CONTENT
                    // 我们需要提取出BASE64_CONTENT部分
                    const result = e.target.result;
                    const base64Start = result.indexOf(',') + 1;
                    
                    if (base64Start <= 0 || base64Start >= result.length) {
                        console.error('无法在DataURL中找到base64内容: ', result.substring(0, 50) + '...');
                        reject(new Error('无法解析文件内容'));
                        return;
                    }
                    
                    const base64Content = result.substring(base64Start);
                    console.log('成功提取base64内容，长度:', base64Content.length);
                    resolve(base64Content);
                } catch (error) {
                    console.error('处理文件读取结果时发生错误:', error);
                    reject(error);
                }
            };
            
            reader.onerror = (error) => {
                console.error('文件读取出错:', error);
                reject(new Error('文件读取失败: ' + (error.message || '未知错误')));
            };
            
            try {
                console.log('开始以DataURL方式读取文件...');
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('调用readAsDataURL失败:', error);
                reject(error);
            }
        });
    }

    /**
     * 获取所有附件
     * @returns {Set<TextAttachment>}
     */
    getAttachments() {
        return this.attachments;
    }

    /**
     * 清理所有附件
     */
    clearAttachments() {
        this.attachments.clear();
    }

    /**
     * 添加已有的附件
     * @param {Object} attachment - 附件数据
     * @returns {Promise<TextAttachment>}
     */
    async addExistingAttachment(attachment) {
        try {
            console.log('添加已有文本附件:', attachment);
            
            // 确保有效的content_id
            if (!attachment.content_id && !attachment.file_path) {
                throw new Error('无效的文本附件，缺少content_id或file_path');
            }
            
            const textAttachment = new TextAttachment({
                fileName: attachment.fileName || attachment.filename,
                mime_type: attachment.mime_type,
                content_id: attachment.content_id || attachment.file_path,
                encoding: attachment.encoding || 'UTF-8',
                lineCount: attachment.lineCount || attachment.line_count || 0,
                size: attachment.size || 0,
                lastModified: attachment.lastModified,
                description: attachment.description
            });
            
            // 保存到附件集合
            this.attachments.add(textAttachment);
            
            return textAttachment;
        } catch (error) {
            console.error('添加已有文本附件失败:', error);
            throw error;
        }
    }

    /**
     * 验证文件是否为文本文件
     * @param {File} file - 文件对象
     * @returns {boolean}
     * @private
     */
    validateFile(file) {
        // 检查文件类型
        const validTextTypes = [
            'text/plain',
            'text/html',
            'text/css',
            'text/javascript',
            'text/markdown',
            'text/xml',
            'application/json',
            'application/xml',
            'application/javascript'
        ];

        // 通过MIME类型判断
        if (file.type && validTextTypes.includes(file.type)) {
            return true;
        }

        // 通过文件扩展名判断
        const extensions = ['.txt', '.md', '.html', '.htm', '.css', '.js', '.json', '.xml', '.log', '.csv'];
        const fileName = file.name.toLowerCase();
        return extensions.some(ext => fileName.endsWith(ext));
    }

    /**
     * 计算文本的行数
     * @param {string} text - 文本内容
     * @returns {number}
     * @private
     */
    countLines(text) {
        return text.split('\n').length;
    }

    /**
     * 保存文本内容到后端
     * @param {string} content - 文本内容
     * @param {string} fileName - 文件名
     * @returns {Promise<Object>} - 包含content_id的后端响应
     * @private
     */
    async saveTextContent(content, fileName) {
        console.log('saveTextContent开始执行:', fileName, '内容长度:', content.length);
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
            console.log('CSRF令牌:', csrfToken ? '已获取' : '未找到');
            
            const requestBody = JSON.stringify({
                content: content,
                fileName: fileName,
                encoding: 'UTF-8'
            });
            console.log('准备发送请求到 /api/text/save, 数据大小:', requestBody.length);
            
            const response = await fetch('/api/text/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: requestBody
            });
            
            console.log('收到后端响应:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorData = await response.json().catch(e => {
                    console.error('解析错误响应失败:', e);
                    return { error: '无法解析错误响应' };
                });
                console.error('保存文本失败，服务器响应:', errorData);
                throw new Error(errorData.error || `保存文本失败 (${response.status})`);
            }
            
            const responseData = await response.json();
            console.log('保存文本成功，服务器返回:', responseData);
            
            if (!responseData.metadata || !responseData.metadata.content_id) {
                console.error('服务器响应缺少content_id:', responseData);
                throw new Error('服务器响应缺少必要的content_id');
            }
            
            return responseData.metadata;
        } catch (error) {
            console.error('保存文本到服务器失败:', error);
            throw error;
        }
    }
}
