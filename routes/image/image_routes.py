import json
from flask import Blueprint, jsonify, session, request
from utils.attachment_handler.image_handler import get_base64_by_id, save_base64_locally
from utils.wrapper import login_required
import os
from pathlib import Path
from initialization import app
import traceback

image_bp = Blueprint('image', __name__)

@image_bp.route('/check_file/<base64_id>')
@login_required
def check_file(base64_id):
    """检查文件状态"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401
        
    try:
        # 使用normalize_user_id函数
        from utils.attachment_handler.image_handler import normalize_user_id
        normalized_user_id = normalize_user_id(user_id)
        base_dir = Path(app.config['UPLOAD_FOLDER']) / normalized_user_id / 'base64_store'
        file_path = base_dir / f"{base64_id}.json"
        
        # 收集状态信息
        status = {
            'base_dir_exists': base_dir.exists(),
            'base_dir_path': str(base_dir),
            'file_exists': file_path.exists(),
            'file_path': str(file_path),
            'upload_folder': str(app.config['UPLOAD_FOLDER']),
            'normalized_user_id': normalized_user_id
        }
        
        if file_path.exists():
            status['file_size'] = os.path.getsize(file_path)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    status['has_base64_data'] = 'base64' in data
                    status['data_keys'] = list(data.keys())
            except Exception as e:
                status['file_read_error'] = str(e)
        
        return jsonify(status)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@image_bp.route('/base64/<base64_id>')
@login_required
def get_base64(base64_id):
    """获取 base64 数据"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401
        
    try:
        base64_data = get_base64_by_id(base64_id, user_id)
        return jsonify({'base64': base64_data})
    except FileNotFoundError as e:
        return jsonify({'error': str(e), 'type': 'file_not_found'}), 404
    except KeyError as e:
        return jsonify({'error': str(e), 'type': 'invalid_data'}), 400
    except json.JSONDecodeError as e:
        return jsonify({'error': str(e), 'type': 'json_error'}), 400
    except Exception as e:
        return jsonify({'error': str(e), 'type': 'unknown_error'}), 500

@image_bp.route('/save_thumbnail', methods=['POST'])
@login_required
def save_thumbnail():
    """保存视频缩略图"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401
        
    try:
        data = request.get_json()
        if not data or 'thumbnail' not in data:
            return jsonify({'error': '缺少缩略图数据'}), 400
            
        # 保存 base64 数据并获取唯一标识符
        base64_id = save_base64_locally(data['thumbnail'], user_id)
        
        return jsonify({
            'message': '缩略图保存成功',
            'base64_id': base64_id
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500 

@image_bp.route('/debug/check_file/<base64_id>')
@login_required
def debug_check_file(base64_id):
    """调试用：检查文件是否存在"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401
        
    try:
        # 使用normalize_user_id函数
        from utils.attachment_handler.image_handler import normalize_user_id
        normalized_user_id = normalize_user_id(user_id)
        base_dir = Path(app.config['UPLOAD_FOLDER']) / normalized_user_id / 'base64_store'
        file_path = base_dir / f"{base64_id}.json"
        
        # 收集状态信息
        status = {
            'base_dir_exists': base_dir.exists(),
            'base_dir_path': str(base_dir),
            'file_exists': file_path.exists(),
            'file_path': str(file_path),
            'upload_folder': str(app.config['UPLOAD_FOLDER']),
            'normalized_user_id': normalized_user_id,
            'user_id': user_id
        }
        
        if file_path.exists():
            status['file_size'] = os.path.getsize(file_path)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    status['has_base64_data'] = 'base64' in data
                    status['data_keys'] = list(data.keys())
            except Exception as e:
                status['file_read_error'] = str(e)
        
        return jsonify(status)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500 

@image_bp.route('/debug/base64/<base64_id>')
@login_required
def debug_base64(base64_id):
    """调试用：检查base64数据获取过程"""
    user_id = session.get('user_id')
    
    debug_info = {
        'user_id': user_id,
        'is_authenticated': user_id is not None,
        'base64_id': base64_id,
        'session_data': dict(session),
        'upload_folder': str(app.config.get('UPLOAD_FOLDER')),
        'current_working_directory': os.getcwd()
    }
    
    if user_id:
        try:
            from utils.attachment_handler.image_handler import normalize_user_id
            normalized_user_id = normalize_user_id(user_id)
            base_dir = Path(app.config['UPLOAD_FOLDER']) / normalized_user_id / 'base64_store'
            file_path = base_dir / f"{base64_id}.json"
            
            debug_info.update({
                'normalized_user_id': normalized_user_id,
                'base_dir': str(base_dir),
                'base_dir_exists': base_dir.exists(),
                'file_path': str(file_path),
                'file_exists': file_path.exists()
            })
            
            if file_path.exists():
                debug_info.update({
                    'file_size': os.path.getsize(file_path),
                    'file_permissions': oct(os.stat(file_path).st_mode)[-3:],
                    'file_owner': os.stat(file_path).st_uid
                })
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        data = json.loads(content)
                        debug_info.update({
                            'file_readable': True,
                            'has_base64_data': 'base64' in data,
                            'data_keys': list(data.keys()),
                            'file_content_preview': content[:100] if len(content) > 100 else content
                        })
                except Exception as e:
                    debug_info.update({
                        'file_readable': False,
                        'read_error': str(e)
                    })
            
            base64_data = get_base64_by_id(base64_id, user_id)
            debug_info.update({
                'base64_exists': base64_data is not None,
                'base64_length': len(base64_data) if base64_data else 0
            })
        except Exception as e:
            debug_info.update({
                'error': str(e),
                'error_type': type(e).__name__
            })
    
    return jsonify(debug_info) 

@image_bp.route('/debug/file_check/<base64_id>')
@login_required
def debug_file_check(base64_id):
    """检查文件系统中的文件状态"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401
        
    try:
        # 使用normalize_user_id函数
        from utils.attachment_handler.image_handler import normalize_user_id
        normalized_user_id = normalize_user_id(user_id)
        base_dir = Path(app.config['UPLOAD_FOLDER']) / normalized_user_id / 'base64_store'
        file_path = base_dir / f"{base64_id}.json"
        
        # 收集文件系统信息
        fs_info = {
            'base_dir_exists': base_dir.exists(),
            'base_dir_path': str(base_dir),
            'file_exists': file_path.exists(),
            'file_path': str(file_path)
        }
        
        if file_path.exists():
            fs_info.update({
                'file_size': os.path.getsize(file_path),
                'file_permissions': oct(os.stat(file_path).st_mode)[-3:],
                'file_owner': os.stat(file_path).st_uid
            })
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    fs_info.update({
                        'file_readable': True,
                        'has_base64_data': 'base64' in data,
                        'data_keys': list(data.keys())
                    })
            except Exception as e:
                fs_info.update({
                    'file_readable': False,
                    'read_error': str(e)
                })
        
        return jsonify(fs_info)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500 

@image_bp.route('/debug/paths')
@login_required
def debug_paths():
    """调试用：检查所有相关路径"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401
        
    try:
        from utils.attachment_handler.image_handler import normalize_user_id
        normalized_user_id = normalize_user_id(user_id)
        
        # 收集路径信息
        paths_info = {
            'current_working_directory': os.getcwd(),
            'initialization_file': os.path.abspath(__file__),
            'upload_folder_config': app.config['UPLOAD_FOLDER'],
            'upload_folder_absolute': os.path.abspath(app.config['UPLOAD_FOLDER']),
            'user_base_dir': str(Path(app.config['UPLOAD_FOLDER']) / normalized_user_id),
            'user_base64_dir': str(Path(app.config['UPLOAD_FOLDER']) / normalized_user_id / 'base64_store'),
            # 添加session相关信息
            'session_data': {
                'user_id': user_id,
                'raw_user_id': str(user_id),
                'user_id_type': type(user_id).__name__,
                'full_session': dict(session)
            }
        }
        
        # 检查目录是否存在
        paths_info.update({
            'upload_folder_exists': os.path.exists(app.config['UPLOAD_FOLDER']),
            'user_base_dir_exists': os.path.exists(paths_info['user_base_dir']),
            'user_base64_dir_exists': os.path.exists(paths_info['user_base64_dir'])
        })
        
        # 如果base64_store目录存在，列出其中的文件
        if paths_info['user_base64_dir_exists']:
            base64_dir = Path(paths_info['user_base64_dir'])
            paths_info['base64_files'] = [f.name for f in base64_dir.glob('*.json')]
        
        # 检查用户表中的信息
        from utils.user_model import User
        user = User.query.get(user_id)
        if user:
            paths_info['user_info'] = {
                'id': user.id,
                'email': user.email,
                'normalized_email': normalize_user_id(user.email)
            }
        
        return jsonify(paths_info)
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'error_type': type(e).__name__,
            'traceback': traceback.format_exc()
        }), 500 