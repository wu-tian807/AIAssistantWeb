// 附件类型枚举
export const AttachmentType = {
    IMAGE: 'image',
    VIDEO: 'video',
    DOCUMENT: 'document',
    TEXT: 'text',
    BINARY: 'binary',
    CSV_TABLE: 'csv_table',
    EXCEL_TABLE: 'excel_table'
};

// 默认配置，作为后备和向下兼容
const DEFAULT_CONFIG = {
    [AttachmentType.IMAGE]: {
        accept: 'image/*',
        maxSize: 1 * 1024 * 1024 * 1024, // 1GB
        description: '图片文件',
        icon: '🖼️',
        mime_types: ['image/*'],
        category: 'image'
    },
    [AttachmentType.VIDEO]: {
        accept: 'video/*',
        maxSize: 2 * 1024 * 1024 * 1024, // 2GB
        description: '视频文件',
        icon: '🎥',
        mime_types: ['video/*'],
        category: 'video'
    },
    [AttachmentType.DOCUMENT]: {
        accept: '.pdf,.doc,.docx,.rtf,.odt',
        maxSize: 50 * 1024 * 1024, // 50MB
        description: '文档文件',
        icon: '📄',
        mime_types: ['application/pdf', 'application/msword'],
        category: 'document'
    },
    [AttachmentType.TEXT]: {
        accept: '.txt,.md,.json,.yaml,.yml',
        maxSize: 10 * 1024 * 1024, // 10MB
        description: '文本文件',
        icon: '📝',
        mime_types: ['text/plain'],
        category: 'text'
    },
    [AttachmentType.BINARY]: {
        accept: '*/*',
        maxSize: 10 * 1024 * 1024, // 10MB
        description: '二进制文件',
        icon: '📦',
        mime_types: ['application/octet-stream'],
        category: 'binary'
    },
    [AttachmentType.CSV_TABLE]: {
        accept: '.csv,.tsv',
        maxSize: 50 * 1024 * 1024, // 50MB
        description: 'CSV表格文件',
        icon: '📊',
        mime_types: ['text/csv', 'text/tab-separated-values'],
        category: 'table'
    },
    [AttachmentType.EXCEL_TABLE]: {
        accept: '.xlsx,.xls,.ods',
        maxSize: 50 * 1024 * 1024, // 50MB
        description: 'Excel表格文件',
        icon: '📈',
        mime_types: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        category: 'table'
    }
};

// 导出的配置对象，初始使用默认值
export let AttachmentConfig = { ...DEFAULT_CONFIG };

// 默认的MIME类型映射
const DEFAULT_MIME_MAPPING = {
    'image/*': AttachmentType.IMAGE,
    'video/*': AttachmentType.VIDEO,
    'text/*': AttachmentType.TEXT,
    'application/octet-stream': AttachmentType.BINARY,
    'text/csv': AttachmentType.CSV_TABLE,
    'application/vnd.ms-excel': AttachmentType.EXCEL_TABLE,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': AttachmentType.EXCEL_TABLE
};

// 导出的MIME类型映射，初始使用默认值
export let MimeTypeMapping = { ...DEFAULT_MIME_MAPPING };

// 动态配置加载器
export class AttachmentTypeLoader {
    constructor() {
        this.config = null;
        this.loading = null;
    }

    // 加载配置
    async loadConfig() {
        if (this.config) {
            return this.config;
        }

        if (this.loading) {
            return await this.loading;
        }

        this.loading = new Promise(async (resolve, reject) => {
            try {
                const response = await fetch('/api/attachment-types');
                const data = await response.json();
                if (data.error) {
                    throw new Error(data.error);
                }
                this.config = data.types;
                
                // 动态更新配置
                this._updateConfigs(this.config);
                
                resolve(this.config);
            } catch (error) {
                console.error('加载附件类型配置失败:', error);
                console.warn('使用默认配置');
                // 出错时使用默认配置
                AttachmentConfig = { ...DEFAULT_CONFIG };
                MimeTypeMapping = { ...DEFAULT_MIME_MAPPING };
                reject(error);
            } finally {
                this.loading = null;
            }
        });

        return await this.loading;
    }

    // 更新所有配置
    _updateConfigs(config) {
        // 更新 AttachmentConfig
        const newConfig = {};
        for (const [category, types] of Object.entries(config)) {
            for (const [typeName, typeConfig] of Object.entries(types)) {
                newConfig[typeName] = {
                    accept: typeConfig.extensions.join(','),
                    maxSize: typeConfig.max_size,
                    description: typeConfig.description,
                    icon: typeConfig.icon || DEFAULT_CONFIG[typeName]?.icon || '📄',
                    mime_types: typeConfig.mime_types,
                    category: category
                };
            }
        }

        // 合并配置，保留默认值作为后备
        AttachmentConfig = {
            ...DEFAULT_CONFIG,  // 默认配置作为后备
            ...newConfig       // 后端配置优先
        };

        // 更新 MimeTypeMapping
        const newMimeMapping = {};
        
        // 首先处理通配符映射（最低优先级）
        for (const [mimeType, type] of Object.entries(DEFAULT_MIME_MAPPING)) {
            if (mimeType.includes('*')) {
                newMimeMapping[mimeType] = type;
            }
        }

        // 然后处理默认的具体映射（中等优先级）
        for (const [mimeType, type] of Object.entries(DEFAULT_MIME_MAPPING)) {
            if (!mimeType.includes('*')) {
                newMimeMapping[mimeType] = type;
            }
        }

        // 最后处理后端配置的映射（最高优先级）
        for (const [category, types] of Object.entries(config)) {
            for (const [typeName, typeConfig] of Object.entries(types)) {
                if (typeConfig.mime_types) {
                    for (const mimeType of typeConfig.mime_types) {
                        // 检查是否存在冲突，忽略 gemini_video 相关的警告
                        if (newMimeMapping[mimeType] && 
                            newMimeMapping[mimeType] !== typeName && 
                            !(typeName === 'gemini_video' || newMimeMapping[mimeType] === 'gemini_video')) {
                            console.warn(`MIME类型 "${mimeType}" 存在多个映射:`, {
                                existing: newMimeMapping[mimeType],
                                new: typeName
                            });
                        }
                        // 如果新类型是 gemini_video，保持原有映射
                        if (typeName !== 'gemini_video') {
                            newMimeMapping[mimeType] = typeName;
                        }
                    }
                }
            }
        }

        // 更新全局映射
        MimeTypeMapping = newMimeMapping;
    }

    // 重新加载配置
    async reloadConfig() {
        this.config = null;
        return await this.loadConfig();
    }
}

// 创建单例实例
export const attachmentTypeLoader = new AttachmentTypeLoader();

// 辅助函数
export const AttachmentUtils = {
    // 原有的同步方法（向下兼容）
    getTypeByExtension(extension) {
        extension = extension.toLowerCase().replace('.', '');
        for (const [type, config] of Object.entries(AttachmentConfig)) {
            const extensions = config.accept.split(',').map(ext => 
                ext.trim().toLowerCase().replace('.', '').replace('*', '')
            );
            if (extensions.includes(extension)) {
                // 只返回类型字符串
                return type;
            }
        }
        // 默认返回 binary 类型字符串
        return AttachmentType.BINARY;
    },

    getTypeByMimeType(mimeType) {
        // 首先检查精确匹配
        if (MimeTypeMapping[mimeType]) {
            return MimeTypeMapping[mimeType];
        }

        // 然后检查通配符匹配
        const mimePrefix = mimeType.split('/')[0] + '/*';
        if (MimeTypeMapping[mimePrefix]) {
            return MimeTypeMapping[mimePrefix];
        }

        // 最后检查配置中的 mime_types
        for (const [type, config] of Object.entries(AttachmentConfig)) {
            if (config.mime_types && config.mime_types.includes(mimeType)) {
                return type;
            }
        }

        // 默认返回 binary 类型字符串
        return AttachmentType.BINARY;
    },

    validateFileSize(type, size) {
        const config = AttachmentConfig[type];
        return size <= config.maxSize;
    },

    validateFileExtension(type, extension) {
        const config = AttachmentConfig[type];
        extension = extension.toLowerCase();
        const acceptedExtensions = config.accept.split(',').map(ext => 
            ext.trim().toLowerCase()
        );
        return acceptedExtensions.includes('*') || 
               acceptedExtensions.includes(extension) ||
               acceptedExtensions.includes('.' + extension);
    },

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

    getConfig(type) {
        return AttachmentConfig[type];
    },

    // 新增的异步方法（推荐使用）
    async getTypeByExtensionAsync(extension) {
        await attachmentTypeLoader.loadConfig();
        return this.getTypeByExtension(extension);
    },

    async getTypeByMimeTypeAsync(mimeType) {
        await attachmentTypeLoader.loadConfig();
        return this.getTypeByMimeType(mimeType);
    },

    async validateFileSizeAsync(type, size) {
        await attachmentTypeLoader.loadConfig();
        return this.validateFileSize(type, size);
    },

    async validateFileExtensionAsync(type, extension) {
        await attachmentTypeLoader.loadConfig();
        return this.validateFileExtension(type, extension);
    },

    async getConfigAsync(type) {
        await attachmentTypeLoader.loadConfig();
        return this.getConfig(type);
    },

    // 类型检查方法
    async getTableTypes() {
        const config = await attachmentTypeLoader.loadConfig();
        return config.table || {};
    },

    async isTableType(type) {
        const config = await attachmentTypeLoader.loadConfig();
        return config.table && Object.keys(config.table).includes(type);
    },

    async isTextType(type) {
        const config = await attachmentTypeLoader.loadConfig();
        return config.text && Object.keys(config.text).includes(type);
    },

    async isBinaryType(type) {
        const config = await attachmentTypeLoader.loadConfig();
        return config.binary && Object.keys(config.binary).includes(type);
    },

    // 同步版本的类型检查（基于 AttachmentConfig）
    isTableTypeSync(type) {
        return AttachmentConfig[type]?.category === 'table';
    },

    isTextTypeSync(type) {
        return AttachmentConfig[type]?.category === 'text';
    },

    isBinaryTypeSync(type) {
        return AttachmentConfig[type]?.category === 'binary';
    },

    // 如果需要完整信息的新方法
    getTypeInfo(type) {
        const config = AttachmentConfig[type];
        if (!config) {
            return {
                type: AttachmentType.BINARY,
                category: 'binary',
                config: AttachmentConfig[AttachmentType.BINARY]
            };
        }
        return {
            type,
            category: config.category,
            config
        };
    },

    getTypeByExtensionWithInfo(extension) {
        const type = this.getTypeByExtension(extension);
        return this.getTypeInfo(type);
    },

    getTypeByMimeTypeWithInfo(mimeType) {
        const type = this.getTypeByMimeType(mimeType);
        return this.getTypeInfo(type);
    }
};
