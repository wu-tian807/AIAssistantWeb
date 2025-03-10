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