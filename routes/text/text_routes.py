import json
from flask import Blueprint, jsonify, session, request
from utils.attachment_handler.text_handler import TextHandler
from utils.wrapper import login_required
import os
from pathlib import Path
from initialization import app
import traceback

text_bp = Blueprint('text', __name__)

@text_bp.route('/content/<content_id>')
@login_required
def get_text_content(content_id):
    """获取文本内容"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401
        
    try:
        content, metadata = TextHandler.get_text_content(content_id, user_id)
        return jsonify({
            'content': content,
            'metadata': metadata
        })
    except FileNotFoundError as e:
        return jsonify({'error': str(e), 'type': 'file_not_found'}), 404
    except json.JSONDecodeError as e:
        return jsonify({'error': str(e), 'type': 'json_error'}), 400
    except Exception as e:
        return jsonify({'error': str(e), 'type': 'unknown_error'}), 500

@text_bp.route('/save', methods=['POST'])
@login_required
def save_text():
    """保存文本内容"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401
        
    try:
        data = request.get_json()
        if not data or 'content' not in data or 'fileName' not in data:
            return jsonify({'error': '缺少必要的文本数据'}), 400
            
        # 可选参数
        encoding = data.get('encoding', 'utf-8')
        
        # 保存文本内容
        metadata = TextHandler.save_text_locally(
            text_content=data['content'],
            file_name=data['fileName'],
            user_id=user_id,
            encoding=encoding
        )
        
        return jsonify({
            'message': '文本保存成功',
            'metadata': metadata
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@text_bp.route('/delete/<content_id>', methods=['DELETE'])
@login_required
def delete_text(content_id):
    """删除文本文件"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401
        
    try:
        success = TextHandler.delete_text_file(content_id, user_id)
        if success:
            return jsonify({'message': '文件删除成功'})
        else:
            return jsonify({'error': '文件删除失败'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500 