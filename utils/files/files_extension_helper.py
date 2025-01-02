import os
from utils.files.file_config import AttachmentType, MIME_TYPE_MAPPING
def get_image_extension(filename,image):
        # 获取文件扩展名
        ext = os.path.splitext(filename)[1].lower()
        if not ext:
            # 如果没有扩展名,根据MIME类型判断
            mime_type = image.content_type
            # 从配置的MIME映射中获取类型
            if mime_type in MIME_TYPE_MAPPING:
                # 如果是图片类型,提取扩展名
                if MIME_TYPE_MAPPING[mime_type] == AttachmentType.IMAGE:
                    # 从MIME类型中提取扩展名
                    ext = '.' + mime_type.split('/')[-1]
                    # 特殊处理jpeg
                    if ext == '.jpeg':
                        ext = '.jpg'
                else:
                    ext = ''
            else:
                ext = ''
        return ext