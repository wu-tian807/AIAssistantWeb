import { AttachmentType, AttachmentUtils } from '../types.js';

/**
 * 文件类型检测器
 */
export class FileTypeDetector {
    static isImage(file) {
        return AttachmentUtils.getTypeByMimeType(file.type) === AttachmentType.IMAGE;
    }

    static isVideo(file) {
        return AttachmentUtils.getTypeByMimeType(file.type) === AttachmentType.VIDEO;
    }

    static isDocument(file) {
        return AttachmentUtils.getTypeByMimeType(file.type) === AttachmentType.DOCUMENT;
    }

    static isDatabase(file) {
        return AttachmentUtils.getTypeByMimeType(file.type) === AttachmentType.DATABASE;
    }

    static isSpreadsheet(file) {
        return AttachmentUtils.getTypeByMimeType(file.type) === AttachmentType.SPREADSHEET;
    }

    static isAudio(file) {
        return AttachmentUtils.getTypeByMimeType(file.type) === AttachmentType.AUDIO;
    }

    static isText(file) {
        return AttachmentUtils.getTypeByMimeType(file.type) === AttachmentType.TEXT;
    }

    static isBinary(file) {
        return AttachmentUtils.getTypeByMimeType(file.type) === AttachmentType.BINARY;
    }

    /**
     * 检测文件类型，返回字符串形式的类型
     * @param {File} file - 文件对象
     * @returns {string} 文件类型字符串，如 'image', 'video', 'text' 等
     */
    static detectType(file) {
        // 首先通过 MIME 类型判断
        const typeByMime = AttachmentUtils.getTypeByMimeType(file.type);

        // 转换为字符串形式的类型
        if (typeByMime !== AttachmentType.BINARY) {
            // 如果已经是字符串，直接返回
            if (typeof typeByMime === 'string') {
                return typeByMime.toLowerCase();
            }
            
            // 如果是枚举类型，转换为字符串
            return String(typeByMime).toLowerCase().replace(/.*\./, '');
        }

        // 如果 MIME 类型无法判断，尝试通过文件扩展名判断
        const extension = file.name.split('.').pop();
        const typeByExt = AttachmentUtils.getTypeByExtension(extension);
        
        // 转换为字符串形式的类型
        if (typeof typeByExt === 'string') {
            return typeByExt.toLowerCase();
        }
        
        // 如果是枚举类型，转换为字符串
        return String(typeByExt).toLowerCase().replace(/.*\./, '');
    }
} 