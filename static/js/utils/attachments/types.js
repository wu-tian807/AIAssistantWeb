// 附件类型枚举
export const AttachmentType = {
    IMAGE: 'image',
    VIDEO: 'video',
    DOCUMENT: 'document',
    AUDIO: 'audio',
    TEXT: 'text',
    BINARY: 'binary',
    DATABASE: 'database',
    SPREADSHEET: 'spreadsheet'
};

// MIME类型映射表
export const MimeTypeMapping = {
    // 图片
    'image/jpeg': AttachmentType.IMAGE,
    'image/png': AttachmentType.IMAGE,
    'image/gif': AttachmentType.IMAGE,
    'image/webp': AttachmentType.IMAGE,
    
    // 视频
    'video/mp4': AttachmentType.VIDEO,
    'video/webm': AttachmentType.VIDEO,
    
    // 文档
    'application/pdf': AttachmentType.DOCUMENT,
    'application/msword': AttachmentType.DOCUMENT,//微软doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': AttachmentType.DOCUMENT,//微软docx
    
    //数据库类型
    'application/x-sqlite3': AttachmentType.DATABASE,
    'application/x-mysql': AttachmentType.DATABASE,
    'application/x-postgresql': AttachmentType.DATABASE,
    'application/x-mongodb': AttachmentType.DATABASE,
    
    // 表格文件
    'application/vnd.ms-excel': AttachmentType.SPREADSHEET,  // xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': AttachmentType.SPREADSHEET, // xlsx
    'text/csv': AttachmentType.SPREADSHEET,
    'application/vnd.oasis.opendocument.spreadsheet': AttachmentType.SPREADSHEET, // ods
    
    // 音频
    'audio/mp3': AttachmentType.AUDIO,
    'audio/wav': AttachmentType.AUDIO,
    
    // 文本
    'text/plain': AttachmentType.TEXT,
    'text/markdown': AttachmentType.TEXT
};

// 文件扩展名映射（用于没有正确MIME类型的情况）
export const ExtensionMapping = {
    // 数据库文件
    'db': AttachmentType.DATABASE,
    'sqlite': AttachmentType.DATABASE,
    'sqlite3': AttachmentType.DATABASE,
    'mdb': AttachmentType.DATABASE,
    'accdb': AttachmentType.DATABASE,
    
    // 表格文件
    'xls': AttachmentType.SPREADSHEET,
    'xlsx': AttachmentType.SPREADSHEET,
    'csv': AttachmentType.SPREADSHEET,
    'ods': AttachmentType.SPREADSHEET,
    
    // 其他类型可以根据需要添加...
};

// 附件类型配置
export const AttachmentConfig = {
    [AttachmentType.DATABASE]: {
        maxSize: 100 * 1024 * 1024, // 100MB
        allowedExtensions: ['db', 'sqlite', 'sqlite3', 'mdb', 'accdb'],
        icon: '🗄️',
        description: '数据库文件'
    },
    [AttachmentType.SPREADSHEET]: {
        maxSize: 50 * 1024 * 1024, // 50MB
        allowedExtensions: ['xls', 'xlsx', 'csv', 'ods'],
        icon: '📊',
        description: '表格文件'
    },
    [AttachmentType.DOCUMENT]: {
        maxSize: 50 * 1024 * 1024, // 50MB
        allowedExtensions: ['pdf', 'doc', 'docx', 'txt', 'rtf'],
        icon: '📄',
        description: '文档'
    },
    [AttachmentType.IMAGE]: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
        icon: '🖼️',
        description: '图片'
    },
    [AttachmentType.VIDEO]: {
        maxSize: 2000 * 1024 * 1024, // 2000MB
        allowedExtensions: ['mp4', 'webm', 'avi', 'mov', 'wmv'],
        icon: '🎥',
        description: '视频'
    },
    [AttachmentType.AUDIO]: {
        maxSize: 50 * 1024 * 1024, // 50MB
        allowedExtensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a'],
        icon: '🎵',
        description: '音频'
    },
    [AttachmentType.TEXT]: {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedExtensions: ['txt', 'md', 'json', 'xml', 'csv', 'log'],
        icon: '📝',
        description: '文本文件'
    },
    [AttachmentType.BINARY]: {
        maxSize: 100 * 1024 * 1024, // 100MB
        allowedExtensions: ['*'], // 允许所有扩展名
        icon: '📎',
        description: '二进制文件'
    }
};

// 添加一些辅助函数
export const AttachmentUtils = {
    // 根据文件扩展名获取类型
    getTypeByExtension(extension) {
        extension = extension.toLowerCase().replace('.', '');
        for (const [ext, type] of Object.entries(ExtensionMapping)) {
            if (ext === extension) return type;
        }
        return AttachmentType.BINARY;
    },

    // 根据MIME类型获取类型
    getTypeByMimeType(mimeType) {
        return MimeTypeMapping[mimeType] || AttachmentType.BINARY;
    },

    // 验证文件大小
    validateFileSize(type, size) {
        const config = AttachmentConfig[type];
        return size <= config.maxSize;
    },

    // 验证文件扩展名
    validateFileExtension(type, extension) {
        const config = AttachmentConfig[type];
        if (config.allowedExtensions.includes('*')) return true;
        return config.allowedExtensions.includes(extension.toLowerCase());
    },

    // 获取友好的文件大小显示
    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    },

    // 获取类型配置
    getConfig(type) {
        return AttachmentConfig[type] || AttachmentConfig[AttachmentType.BINARY];
    }
};
