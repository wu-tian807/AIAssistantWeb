import json
from flask import Blueprint, jsonify, session, request
from utils.attachment_handler.text_handler import TextHandler
from utils.wrapper import login_required
import os
from pathlib import Path
from initialization import app
import traceback
import asyncio
import time
import threading
from utils.text_encoding import detect_encoding, fix_encoding, is_chinese_corrupted, recover_corrupted_chinese
from utils.attachment_handler.image_handler import normalize_user_id
from utils.text_attachment.embeddings import TextEmbedding
from utils.text_attachment.evaluate_text_type import evaluate_text_type

text_bp = Blueprint('text', __name__)

# 辅助函数：在线程中运行异步任务
def run_async_task_in_thread(coroutine_func, *args, **kwargs):
    """在新线程中运行异步协程函数"""
    def run_in_thread():
        # 创建新的事件循环
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            # 运行协程任务
            loop.run_until_complete(coroutine_func(*args, **kwargs))
        except Exception as e:
            print(f"异步任务执行出错: {str(e)}")
            print(traceback.format_exc())
        finally:
            # 关闭事件循环
            loop.close()
    
    # 启动线程
    thread = threading.Thread(target=run_in_thread)
    thread.daemon = True  # 设为守护线程，随主进程退出
    thread.start()
    return thread

@text_bp.route('/content/<content_id>')
@login_required
def get_text_content(content_id):
    """获取文本内容"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401
        
    try:
        content, metadata = TextHandler.get_text_content(content_id, user_id)
        # 从元数据中提取文件名和大小
        file_name = metadata.get('file_name', '')
        # 从文件名中提取扩展名，如果没有扩展名，强制使用.txt
        file_extension = os.path.splitext(file_name)[1]
        if not file_extension:  # 如果文件名没有扩展名
            file_extension = '.txt'  # 强制使用.txt扩展名
            
        file_size = metadata.get('size', 0)
        
        print(f"获取文本内容 - ID: {content_id}, 文件名: {file_name}, 扩展名: {file_extension}, 大小: {file_size}")
        
        return jsonify({
            'content': content,
            'metadata': metadata,
            'size': file_size,
            'extension': file_extension
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
        
        # 检测编码和中文乱码
        content = data['content']
        if is_chinese_corrupted(content):
            print("检测到中文乱码，尝试修复...")
            content = recover_corrupted_chinese(content)
            
        # 获取基本信息
        normalized_user_id = normalize_user_id(user_id)
        base_dir = Path(app.config['UPLOAD_FOLDER']) / normalized_user_id
        text_dir = base_dir / 'text_files'
        text_dir.mkdir(parents=True, exist_ok=True)
        
        # 生成唯一文件名和基本元数据
        timestamp = int(time.time() * 1000)
        unique_id = f"{timestamp}"
        
        # 确保文件名包含扩展名
        file_name = data['fileName']
        if not os.path.splitext(file_name)[1]:  # 如果没有扩展名
            file_name = file_name + '.txt'  # 添加默认扩展名
        
        # 保存文本内容
        file_path = text_dir / f"{unique_id}.txt"
        with open(str(file_path), 'w', encoding=encoding) as f:
            f.write(content)
        
        # 创建基本元数据
        basic_metadata = {
            'file_name': file_name,  # 已确保包含扩展名
            'content_id': unique_id,
            'created_at': timestamp,
            'encoding': encoding,
            'size': len(content.encode(encoding)),
            'line_count': len(content.splitlines()),
            'file_path': str(file_path),
            # 临时默认值，后续异步更新
            'text_type': "普通文章",
            'line_length': 100,
            'creativity_score': 0.5
        }
        
        # 保存元数据
        metadata_path = text_dir / f"{unique_id}_meta.json"
        with open(str(metadata_path), 'w', encoding='utf-8') as f:
            json.dump(basic_metadata, f, ensure_ascii=False, indent=2)
        
        # 在新线程中处理后台任务
        run_async_task_in_thread(
            process_text_background,
            content=content,
            content_id=unique_id,
            user_id=user_id,
            base_dir=base_dir,
            encoding=encoding
        )
        
        print(f"文本初步保存成功 - ID: {unique_id}，开始后台处理")
        return jsonify({
            'message': '文本保存成功',
            'metadata': basic_metadata
        })
    except Exception as e:
        error_msg = f"保存文本失败: {str(e)}"
        print(f"\n=== 错误 ===")
        print(error_msg)
        print(f"错误详情:\n{traceback.format_exc()}")
        return jsonify({'error': error_msg}), 500

@text_bp.route('/upload', methods=['POST'])
@login_required
def upload_text():
    """处理文本文件上传"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401
        
    try:
        # 验证CSRF Token
        if request.headers.get('X-CSRF-Token') != session.get('csrf_token'):
            return jsonify({'error': 'CSRF验证失败'}), 403
            
        if 'file' not in request.files:
            return jsonify({'error': '未找到文件'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '未选择文件'}), 400
            
        # 检查文件大小
        file_content = file.read()
        file.seek(0)  # 重置文件指针
        
        if len(file_content) > 10 * 1024 * 1024:  # 10MB限制
            return jsonify({'error': '文件大小超过限制（最大10MB）'}), 413
            
        # 检测文件编码
        detected_encoding = detect_encoding(file_content)
        encoding = detected_encoding or 'utf-8'
        print(f"检测到文件编码: {encoding}")
        
        try:
            # 尝试以检测到的编码读取文件内容
            text_content = file_content.decode(encoding)
        except UnicodeDecodeError:
            # 如果解码失败，尝试修复编码
            text_content = fix_encoding(file_content, detected_encoding=encoding)
            
        # 获取文件名
        file_name = request.form.get('fileName') or file.filename
        
        # 保存文本文件
        normalized_user_id = normalize_user_id(user_id)
        base_dir = Path(app.config['UPLOAD_FOLDER']) / normalized_user_id
        text_dir = base_dir / 'text_files'
        text_dir.mkdir(parents=True, exist_ok=True)
        
        # 生成唯一ID
        timestamp = int(time.time() * 1000)
        unique_id = f"{timestamp}"
        
        # 获取原始文件扩展名
        original_extension = os.path.splitext(file_name)[1]
        if not original_extension:  # 如果没有扩展名
            original_extension = '.txt'  # 默认使用.txt
            file_name = file_name + original_extension  # 确保文件名有扩展名
            
        # 保存文本内容 - 使用唯一ID+扩展名作为文件名
        file_path = text_dir / f"{unique_id}.txt"  # 始终使用.txt保存
        with open(str(file_path), 'w', encoding=encoding) as f:
            f.write(text_content)
            
        print(f"保存文本文件 - ID: {unique_id}, 原始文件名: {file_name}, 扩展名: {original_extension}, 大小: {len(file_content)} 字节")
        
        # 创建基本元数据
        metadata = {
            'file_name': file_name,
            'content_id': unique_id,
            'created_at': timestamp,
            'encoding': encoding,
            'size': len(file_content),
            'line_count': len(text_content.splitlines()),
            'file_path': str(file_path),
            'text_type': "普通文章",  # 临时默认值
            'line_length': 100,
            'creativity_score': 0.5
        }
        
        # 保存元数据
        metadata_path = text_dir / f"{unique_id}_meta.json"
        with open(str(metadata_path), 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        # 在新线程中处理后台任务
        run_async_task_in_thread(
            process_text_background,
            content=text_content,
            content_id=unique_id,
            user_id=user_id,
            base_dir=base_dir,
            encoding=encoding
        )
        
        return jsonify({
            'message': '文件上传成功',
            'metadata': metadata
        })
        
    except Exception as e:
        error_msg = f"上传文本失败: {str(e)}"
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

@text_bp.route('/test_async', methods=['GET'])
def test_async():
    """测试异步处理功能是否正常工作"""
    try:
        # 创建一个简单的异步测试函数
        async def test_async_func():
            print("开始执行异步测试任务")
            await asyncio.sleep(2)  # 模拟异步操作
            print("异步测试任务执行完成")
            return "测试成功"
        
        # 在线程中运行异步测试
        run_async_task_in_thread(test_async_func)
        
        return jsonify({
            'status': 'success',
            'message': '异步测试任务已启动，请查看服务器日志'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'异步测试失败: {str(e)}'
        }), 500

async def process_text_background(content, content_id, user_id, base_dir, encoding):
    """后台处理文本：分析类型和生成embeddings"""
    try:
        print(f"开始后台处理文本 ID: {content_id}")
        
        # 1. 分析文本类型（设置超时）
        try:
            # 使用默认值，避免卡在这里
            default_result = {
                "type": "普通文章",
                "line_length": 100,
                "creativity_score": 0.5,
                "type_reason": "默认分析",
                "creativity_reason": "默认分析"
            }
            
            # 设置较小的重试次数
            text_analysis = evaluate_text_type(content, max_retry=1) or default_result
            
            text_type = text_analysis.get('type', "普通文章")
            line_length = text_analysis.get('line_length', 100)
            creativity_score = text_analysis.get('creativity_score', 0.5)
            
            print(f"文本类型分析完成: {text_type}, 行长度: {line_length}, 创意分: {creativity_score}")
        except Exception as e:
            print(f"文本类型分析失败，使用默认值: {str(e)}")
            text_type = "普通文章"
            line_length = 100
            creativity_score = 0.5
        
        # 2. 更新元数据
        text_dir = base_dir / 'text_files'
        metadata_path = text_dir / f"{content_id}_meta.json"
        
        try:
            with open(str(metadata_path), 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            metadata.update({
                'text_type': text_type,
                'line_length': line_length,
                'creativity_score': creativity_score
            })
            
            with open(str(metadata_path), 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
                
            print(f"元数据更新完成: {content_id}")
        except Exception as e:
            print(f"更新元数据失败: {str(e)}")
        
        # 3. 生成embeddings（这部分可能比较耗时）
        try:
            embedding_processor = TextEmbedding()
            embedding_result = await embedding_processor.process_text(
                text=content,
                file_id=content_id,
                base_path=str(base_dir),
                text_type=text_type,
                line_length=line_length,
                creativity_score=creativity_score
            )
            
            # 再次更新元数据，添加embedding信息
            with open(str(metadata_path), 'r', encoding='utf-8') as f:
                metadata = json.load(f)
                
            metadata['embedding'] = embedding_result
            
            with open(str(metadata_path), 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
                
            print(f"Embeddings生成完成: {content_id}")
        except Exception as e:
            print(f"生成embeddings失败: {str(e)}")
            print(traceback.format_exc())
        
        print(f"文本ID {content_id} 后台处理完成")
    except Exception as e:
        print(f"后台处理文本失败: {str(e)}")
        print(traceback.format_exc()) 