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

// 定义空的配置对象，将在加载时从后端填充
const DEFAULT_CONFIG = {};
export let AttachmentConfig = {};

// 定义空的MIME类型映射，将在加载时从后端填充
const DEFAULT_MIME_MAPPING = {};
export let MimeTypeMapping = {};

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
                
                // 使用后端返回的MIME类型映射
                if (data.mime_mapping) {
                    MimeTypeMapping = data.mime_mapping;
                }
                
                // 动态更新配置
                this._updateConfigs(this.config);
                
                resolve(this.config);
            } catch (error) {
                console.error('加载附件类型配置失败:', error);
                console.warn('无法加载附件类型配置');
                // 出错时保持空配置，需要由客户端处理错误情况
                AttachmentConfig = {};
                MimeTypeMapping = {};
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
                    icon: typeConfig.icon || '📄',
                    mime_types: typeConfig.mime_types,
                    category: category
                };
            }
        }

        // 直接使用后端配置
        AttachmentConfig = newConfig;
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
    // 在实际使用前确保配置已加载
    async ensureConfigLoaded() {
        try {
            await attachmentTypeLoader.loadConfig();
        } catch (error) {
            console.error('确保配置加载失败:', error);
        }
    },

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
        await this.ensureConfigLoaded();
        return this.getTypeByExtension(extension);
    },

    async getTypeByMimeTypeAsync(mimeType) {
        await this.ensureConfigLoaded();
        return this.getTypeByMimeType(mimeType);
    },

    async validateFileSizeAsync(type, size) {
        await this.ensureConfigLoaded();
        return this.validateFileSize(type, size);
    },

    async validateFileExtensionAsync(type, extension) {
        await this.ensureConfigLoaded();
        return this.validateFileExtension(type, extension);
    },

    async getConfigAsync(type) {
        await this.ensureConfigLoaded();
        return this.getConfig(type);
    },

    // 类型检查方法
    async getTableTypes() {
        const config = await attachmentTypeLoader.loadConfig();
        return config.table || {};
    },

    async isTableType(type) {
        await this.ensureConfigLoaded();
        return AttachmentConfig[type]?.category === 'table';
    },

    async isTextType(type) {
        await this.ensureConfigLoaded();
        return AttachmentConfig[type]?.category === 'text';
    },

    async isBinaryType(type) {
        await this.ensureConfigLoaded();
        return AttachmentConfig[type]?.category === 'binary';
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
