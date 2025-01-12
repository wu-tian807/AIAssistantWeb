import json
from flask import Blueprint, jsonify, session, request
from utils.attachment_handler.text_handler import TextHandler
from utils.wrapper import login_required
import os
from pathlib import Path
from initialization import app
import traceback
import asyncio

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
        # 验证CSRF Token
        if request.headers.get('X-CSRF-Token') != session.get('csrf_token'):
            print(f"CSRF验证失败 - 请求token: {request.headers.get('X-CSRF-Token')}, 会话token: {session.get('csrf_token')}")
            return jsonify({'error': 'CSRF验证失败'}), 403
            
        # 检查请求大小
        content_length = request.content_length
        if content_length and content_length > 10 * 1024 * 1024:  # 10MB限制
            return jsonify({'error': '文件大小超过限制（最大10MB）'}), 413
            
        data = request.get_json()
        if not data:
            print("请求数据为空")
            return jsonify({'error': '请求数据为空'}), 400
            
        if 'content' not in data or 'fileName' not in data:
            print(f"缺少必要字段 - 收到的数据: {data}")
            return jsonify({'error': '缺少必要的文本数据'}), 400
            
        # 可选参数
        encoding = data.get('encoding', 'utf-8')
        
        print(f"\n=== 开始保存文本 ===")
        print(f"文件名: {data['fileName']}")
        print(f"编码: {encoding}")
        print(f"内容长度: {len(data['content'])} 字符")
        
        # 保存文本内容和生成embeddings
        try:
            metadata = asyncio.run(TextHandler.save_text_locally(
                text_content=data['content'],
                file_name=data['fileName'],
                user_id=user_id,
                encoding=encoding
            ))
            
            print(f"文本保存成功 - 元数据: {metadata}")
            return jsonify({
                'message': '文本保存成功',
                'metadata': metadata
            })
            
        except asyncio.TimeoutError:
            print("保存文本超时")
            return jsonify({'error': '操作超时，请重试'}), 504
        except MemoryError:
            print("内存不足")
            return jsonify({'error': '服务器内存不足，请稍后重试'}), 507
        except Exception as e:
            print(f"保存文本时发生错误: {str(e)}")
            print(f"错误详情:\n{traceback.format_exc()}")
            return jsonify({'error': str(e)}), 500
            
    except json.JSONDecodeError as e:
        print(f"JSON解析错误: {str(e)}")
        return jsonify({'error': '无效的JSON数据'}), 400
    except Exception as e:
        error_msg = f"保存文本失败: {str(e)}"
        print(f"\n=== 错误 ===")
        print(error_msg)
        print(f"错误详情:\n{traceback.format_exc()}")
        return jsonify({'error': error_msg}), 500

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