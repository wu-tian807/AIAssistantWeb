from flask import Blueprint, jsonify
from utils.files.file_config import ATTACHMENT_TYPES, AttachmentType

# 创建蓝图
upload_attachment_types_bp = Blueprint('upload_attachment_types', __name__)

@upload_attachment_types_bp.route('/api/attachment-types', methods=['GET'])
def get_attachment_types():
    """
    获取所有支持的附件类型配置
    返回统一的附件类型定义，供前端使用
    """
    try:
        # 创建可序列化的配置
        serializable_types = {
            'table': {},      # 表格类文件（CSV和Excel）
            'text': {},       # 文本类文件
            'binary': {},     # 二进制文件
            'all': {}         # 所有类型
        }
        
        # 定义类型分类
        type_categories = {
            # 表格类
            'table': [AttachmentType.CSV_TABLE, AttachmentType.EXCEL_TABLE],
            # 文本类
            'text': [AttachmentType.TEXT],
            # 二进制类
            'binary': [
                AttachmentType.IMAGE, AttachmentType.VIDEO, 
                AttachmentType.DOCUMENT, AttachmentType.BINARY,
                AttachmentType.GEMINI_VIDEO
            ]
        }
        
        # 定义图标映射
        icons = {
            'csv_table': '📊',
            'excel_table': '📊',
            'text': '📝',
            'image': '🖼️',
            'video': '🎥',
            'document': '📄',
            'binary': '📎',
            'gemini_video': '🎬'
        }
        
        # 处理每个类型
        for category, types in type_categories.items():
            for attachment_type in types:
                type_name = attachment_type.name.lower()
                type_config = ATTACHMENT_TYPES[attachment_type].copy()
                type_config['icon'] = icons.get(type_name, '📁')
                
                # 添加到对应分类
                serializable_types[category][type_name] = type_config
                # 添加到所有类型
                serializable_types['all'][type_name] = type_config

        return jsonify({
            'types': serializable_types,
            'message': '获取附件类型配置成功'
        })

    except Exception as e:
        return jsonify({
            'error': f'获取附件类型配置失败: {str(e)}'
        }), 500

@upload_attachment_types_bp.route('/api/attachment-types/table', methods=['GET'])
def get_table_types():
    """获取所有表格类型的附件配置"""
    try:
        serializable_types = {}
        table_types = [AttachmentType.CSV_TABLE, AttachmentType.EXCEL_TABLE]
        
        for attachment_type in table_types:
            type_name = attachment_type.name.lower()
            serializable_types[type_name] = ATTACHMENT_TYPES[attachment_type].copy()
            
        return jsonify({
            'types': serializable_types,
            'message': '获取表格类型配置成功'
        })
    except Exception as e:
        return jsonify({
            'error': f'获取表格类型配置失败: {str(e)}'
        }), 500
