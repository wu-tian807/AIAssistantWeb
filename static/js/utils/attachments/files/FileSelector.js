//需要进一步梳理，未来正确处理uploader并且合适的再script.js中调用通用的文件选择器
import { AttachmentType, AttachmentUtils } from '../types.js';
import { imageUploader } from '../uploader/ImageUploader.js';

export class FileSelector {
    constructor(options = {}) {
        this.options = {
            multiple: options.multiple || false,
            accept: options.accept || '*/*',
            maxSize: options.maxSize || null
        };
        this.onFileSelected = options.onFileSelected || (() => {});
        this._processing = false; // 添加处理状态标志
        this._input = null; // 保存 input 元素的引用
    }

    select() {
        return new Promise((resolve, reject) => {
            try {
                if (this._processing) {
                    reject(new Error('正在处理文件'));
                    return;
                }

                // 如果已经有 input 元素，先移除它
                if (this._input) {
                    document.body.removeChild(this._input);
                }

                // 创建新的 input 元素
                this._input = document.createElement('input');
                this._input.type = 'file';
                this._input.multiple = this.options.multiple;
                this._input.accept = this.options.accept;
                this._input.style.display = 'none';
                
                document.body.appendChild(this._input);

                this._input.onchange = async (e) => {
                    const files = Array.from(e.target.files || []);
                    try {
                        await this.handleFiles(files);
                        resolve(files);
                    } catch (error) {
                        reject(error);
                    } finally {
                        // 清理 input 元素
                        document.body.removeChild(this._input);
                        this._input = null;
                    }
                };

                // 触发文件选择对话框
                this._input.click();
            } catch (error) {
                reject(error);
            }
        });
    }

    async handleFiles(files) {
        if (this._processing) {
            throw new Error('正在处理文件');
        }
        
        this._processing = true;
        console.log('开始处理文件:', files); // 调试日志

        try {
            const validFiles = [];
            for (const file of files) {
                if (this.validateFile(file)) {
                    validFiles.push(file);
                } else {
                    console.warn(`文件验证失败: ${file.name}`);
                }
            }

            if (validFiles.length > 0) {
                await this.onFileSelected(validFiles);
            }
        } catch (error) {
            console.error('文件处理失败:', error);
            throw error;
        } finally {
            this._processing = false;
        }
    }

    validateFile(file) {
        // 验证文件类型
        if (this.options.accept !== '*/*') {
            const acceptTypes = this.options.accept.split(',').map(type => type.trim());
            const isValidType = acceptTypes.some(type => {
                if (type.startsWith('.')) {
                    // 检查文件扩展名
                    return file.name.toLowerCase().endsWith(type.toLowerCase());
                } else if (type.endsWith('/*')) {
                    // 检查MIME类型组（如 image/*）
                    const typeGroup = type.split('/')[0];
                    return file.type.startsWith(`${typeGroup}/`);
                } else {
                    // 检查具体MIME类型
                    return file.type === type;
                }
            });

            if (!isValidType) {
                console.warn(`不支持的文件类型: ${file.type}`);
                return false;
            }
        }

        // 验证文件大小
        if (this.options.maxSize && file.size > this.options.maxSize) {
            console.warn(`文件太大: ${file.size} 字节`);
            return false;
        }

        return true;
    }
}