# 附件类型枚举
class AttachmentType:
    IMAGE = 'image'
    VIDEO = 'video' 
    DOCUMENT = 'document'
    AUDIO = 'audio'
    TEXT = 'text'
    BINARY = 'binary'
    DATABASE = 'database'    # 新增数据库类型
    SPREADSHEET = 'spreadsheet'  # 新增表格类型

# MIME类型映射表
MIME_TYPE_MAPPING = {
    # 图片
    'image/jpeg': AttachmentType.IMAGE,
    'image/png': AttachmentType.IMAGE,
    'image/gif': AttachmentType.IMAGE,
    'image/webp': AttachmentType.IMAGE,
    
    # 视频
    'video/mp4': AttachmentType.VIDEO,
    'video/webm': AttachmentType.VIDEO,
    
    # 文档
    'application/pdf': AttachmentType.DOCUMENT,
    'application/msword': AttachmentType.DOCUMENT,  # 微软doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': AttachmentType.DOCUMENT,  # 微软docx
    
    # 数据库类型
    'application/x-sqlite3': AttachmentType.DATABASE,
    'application/x-mysql': AttachmentType.DATABASE,
    'application/x-postgresql': AttachmentType.DATABASE,
    'application/x-mongodb': AttachmentType.DATABASE,
    
    # 表格文件
    'application/vnd.ms-excel': AttachmentType.SPREADSHEET,  # xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': AttachmentType.SPREADSHEET,  # xlsx
    'text/csv': AttachmentType.SPREADSHEET,
    'application/vnd.oasis.opendocument.spreadsheet': AttachmentType.SPREADSHEET,  # ods
    
    # 音频
    'audio/mp3': AttachmentType.AUDIO,
    'audio/wav': AttachmentType.AUDIO,
    
    # 文本
    'text/plain': AttachmentType.TEXT,
    'text/markdown': AttachmentType.TEXT
}