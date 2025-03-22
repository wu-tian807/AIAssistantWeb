from enum import Enum, auto

class AttachmentType(Enum):
    IMAGE = auto()
    VIDEO = auto()
    DOCUMENT = auto()
    TEXT = auto()
    BINARY = auto()
    GEMINI_VIDEO = auto()
    CSV_TABLE = auto()      # 新增：CSV格式表格
    EXCEL_TABLE = auto()    # 新增：Excel格式表格
    
    @property
    def value_str(self):
        """返回用于序列化和日志显示的字符串值"""
        return self.name.lower()
    
    @classmethod
    def from_string(cls, string_value):
        """从字符串转换回枚举类型
        
        Args:
            string_value (str): 字符串表示，如'text'、'image'等
            
        Returns:
            AttachmentType: 对应的枚举值，如果找不到匹配项则返回BINARY
        """
        if not string_value:
            return cls.BINARY
            
        try:
            # 尝试直接匹配名称（不区分大小写）
            return cls[string_value.upper()]
        except KeyError:
            # 尝试遍历所有枚举值进行匹配
            for enum_type in cls:
                if enum_type.value_str == string_value.lower():
                    return enum_type
            
            # 默认返回二进制类型
            print(f"警告: 无法识别的附件类型字符串 '{string_value}'，使用默认值 BINARY")
            return cls.BINARY
    
    def __str__(self):
        """返回字符串表示，便于日志输出"""
        return self.value_str

ATTACHMENT_TYPES = {
    AttachmentType.IMAGE: {
        'extensions': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.heif'],
        'mime_types': ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/heic', 'image/heif'],
        'max_size': 1 * 1024 * 1024 * 1024,  # 1GB
        'description': '图片文件'
    },
    AttachmentType.VIDEO: {
        'extensions': ['.mp4', '.webm', '.ogg', '.mkv', '.m4v', '.ts', '.mts', '.vob', '.divx', '.rm', '.rmvb', '.asf'],
        'mime_types': [
            'video/mp4', 'video/webm', 'video/ogg',
            'video/x-matroska',    # .mkv
            'video/x-m4v',         # .m4v
            'video/mp2t',          # .ts, .mts
            'video/x-vob',         # .vob
            'video/x-divx',        # .divx
            'video/vnd.rn-realvideo', # .rm, .rmvb
            'video/x-ms-asf'       # .asf
        ],
        'max_size': 2 * 1024 * 1024 * 1024,  # 2GB (与Gemini限制一致)
        'description': '视频文件'
    },
    AttachmentType.DOCUMENT: {
        'extensions': [
            '.pdf', '.doc', '.docx', '.rtf', '.odt',
            '.ppt', '.pptx', '.odp', '.key',
            '.epub', '.mobi', '.azw', '.azw3'
        ],
        'mime_types': [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/rtf',
            'application/vnd.oasis.opendocument.text',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.oasis.opendocument.presentation',
            'application/x-iwork-keynote-sffkey',
            'application/epub+zip',
            'application/x-mobipocket-ebook',
            'application/vnd.amazon.ebook'
        ],
        'max_size': 50 * 1024 * 1024,  # 50MB
        'description': '文档文件'
    },
    AttachmentType.TEXT: {
        'extensions': [
            # 纯文本
            '.txt', '.text',
            # 代码文件
            '.py', '.js', '.java', '.cpp', '.c', '.h', '.cs', '.php', '.rb', '.go', '.rs', '.swift',
            # 标记语言
            '.md', '.markdown', '.rst', '.adoc',
            # 配置文件
            '.json', '.yaml', '.yml', '.toml', '.ini', '.conf',
            # 网页相关
            '.html', '.htm', '.css', '.xml', '.svg'
        ],
        'mime_types': [
            # 纯文本
            'text/plain',
            # 代码文件
            'text/x-python',
            'application/javascript',
            'text/javascript',
            'text/x-java',
            'text/x-c',
            'text/x-csharp',
            'application/x-php',
            'text/x-ruby',
            'text/x-go',
            'text/x-rust',
            'text/x-swift',
            # 标记语言
            'text/markdown',
            'text/x-rst',
            'text/asciidoc',
            # 配置文件
            'application/json',
            'application/x-yaml',
            'application/toml',
            # 网页相关
            'text/html',
            'text/css',
            'application/xml',
            'image/svg+xml'
        ],
        'max_size': 10 * 1024 * 1024,  # 10MB
        'description': '文本文件'
    },
    AttachmentType.CSV_TABLE: {
        'extensions': ['.csv', '.tsv'],
        'mime_types': ['text/csv', 'text/tab-separated-values'],
        'max_size': 50 * 1024 * 1024,  # 50MB
        'description': '文本表格文件'
    },
    AttachmentType.EXCEL_TABLE: {
        'extensions': ['.xlsx', '.xls', '.ods'],
        'mime_types': [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/vnd.oasis.opendocument.spreadsheet'
        ],
        'max_size': 50 * 1024 * 1024,  # 50MB
        'description': '二进制表格文件'
    },
    AttachmentType.BINARY: {
        'extensions': ['*'],
        'mime_types': ['application/octet-stream'],
        'max_size': 10 * 1024 * 1024,  # 10MB
        'description': '二进制文件'
    },
    AttachmentType.GEMINI_VIDEO: {
        'extensions': ['.mp4', '.mpeg', '.mov', '.avi', '.flv', '.mpg', '.webm', '.wmv', '.3gpp'],
        'mime_types': ['video/mp4', 'video/mpeg', 'video/mov', 'video/avi', 'video/x-flv', 'video/mpg', 'video/webm', 'video/wmv', 'video/3gpp'],
        'max_size': 2 * 1024 * 1024 * 1024,  # 2GB
        'description': 'Gemini支持的视频格式'
    }
}

# MIME类型到附件类型的映射
MIME_TYPE_MAPPING = {}

# 首先添加基本类型的映射
for attachment_type, config in ATTACHMENT_TYPES.items():
    # 跳过GEMINI_VIDEO，它的MIME类型应该先映射到VIDEO
    if attachment_type == AttachmentType.GEMINI_VIDEO:
        continue
    for mime_type in config['mime_types']:
        MIME_TYPE_MAPPING[mime_type] = attachment_type

# 确保所有视频MIME类型都映射到VIDEO
for mime_type in ATTACHMENT_TYPES[AttachmentType.VIDEO]['mime_types']:
    MIME_TYPE_MAPPING[mime_type] = AttachmentType.VIDEO

# 添加一些未在类型配置中明确列出但常见的MIME类型映射
ADDITIONAL_MIME_MAPPINGS = {
    # 文本相关
    'text/javascript': AttachmentType.TEXT,
    'text/typescript': AttachmentType.TEXT,
    'text/jsx': AttachmentType.TEXT,
    'text/tsx': AttachmentType.TEXT,
    'text/x-python': AttachmentType.TEXT,
    'application/x-javascript': AttachmentType.TEXT,
    'application/typescript': AttachmentType.TEXT,
    'application/x-typescript': AttachmentType.TEXT,
    'application/yaml': AttachmentType.TEXT,
    'application/x-yaml': AttachmentType.TEXT,
    'text/yaml': AttachmentType.TEXT,
    'text/x-yaml': AttachmentType.TEXT,
    'application/xml': AttachmentType.TEXT,
    'text/xml': AttachmentType.TEXT,
    
    # 文档相关
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': AttachmentType.DOCUMENT,
    'application/vnd.oasis.opendocument.text': AttachmentType.DOCUMENT,
    
    # 表格相关
    'text/x-csv': AttachmentType.CSV_TABLE,
    'application/csv': AttachmentType.CSV_TABLE,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': AttachmentType.EXCEL_TABLE,
    'application/vnd.oasis.opendocument.spreadsheet': AttachmentType.EXCEL_TABLE
}

# 添加额外的映射
for mime_type, attachment_type in ADDITIONAL_MIME_MAPPINGS.items():
    if mime_type not in MIME_TYPE_MAPPING:
        MIME_TYPE_MAPPING[mime_type] = attachment_type

# 添加通配符映射（用于前端展示）
MIME_TYPE_WILDCARDS = {
    'image/*': AttachmentType.IMAGE,
    'video/*': AttachmentType.VIDEO,
    'text/*': AttachmentType.TEXT
}