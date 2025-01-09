from flask import Blueprint, request, jsonify, current_app, session, abort
from werkzeug.utils import secure_filename
import os
from datetime import datetime
from utils.wrapper import login_required
from utils.user_model import User, db
from utils.files.files_extension_helper import get_image_extension
from utils.attachment_handler.image_handler import encode_image

# 创建蓝图
user_profile = Blueprint('user_profile', __name__)

# 配置头像存储路径
PROFILE_ICONS_DIR = 'profile_icons'
PROFILE_ICONS_RELATIVE_PATH = os.path.join('uploads', PROFILE_ICONS_DIR)

def verify_user_access(user_id):
    """验证用户访问权限"""
    if 'user_id' not in session:
        return False
    return session['user_id'] == user_id

# 上传头像
@user_profile.route('/api/user/upload_profile_icon', methods=['POST'])
@login_required
def upload_profile_icon():
    try:
        if not verify_user_access(session['user_id']):
            return jsonify({'error': '无权访问'}), 403

        # 验证CSRF Token
        if request.headers.get('X-CSRF-Token') != session.get('csrf_token'):
            return jsonify({'error': 'CSRF验证失败'}), 403

        if 'icon' not in request.files:
            return jsonify({'error': '没有上传文件'}), 400
            
        icon = request.files['icon']
        if icon.filename == '':
            return jsonify({'error': '没有选择文件'}), 400

        # 验证文件大小（例如最大5MB）
        if len(icon.read()) > 5 * 1024 * 1024:  # 5MB in bytes
            return jsonify({'error': '文件大小超过限制'}), 400
        icon.seek(0)  # 重置文件指针
            
        # 获取当前用户
        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': '用户未找到'}), 404
            
        # 处理文件名
        original_filename = secure_filename(icon.filename)
        if not original_filename:
            return jsonify({'error': '文件名无效'}), 400
            
        # 获取文件扩展名并验证文件类型
        ext = get_image_extension(original_filename, icon)
        if not ext:
            return jsonify({'error': '不支持的文件格式'}), 400
        
        # 验证文件类型（只允许图片）
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif'}
        if ext.lower() not in allowed_extensions:
            return jsonify({'error': '不支持的文件格式'}), 400
            
        # 生成新文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        new_filename = f"profile_icon_{user.id}_{timestamp}{ext}" 
        
        # 创建用户头像目录
        icon_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], PROFILE_ICONS_DIR)
        os.makedirs(icon_folder, exist_ok=True)
        
        # 保存文件
        icon_path = os.path.join(icon_folder, new_filename)
        icon.save(icon_path)
        
        # 删除旧头像文件（如果存在）
        if user.profile_icon:
            old_icon_path = os.path.join(current_app.root_path, user.profile_icon)
            if os.path.exists(old_icon_path):
                os.remove(old_icon_path)
        
        # 更新数据库中的头像路径
        relative_path = os.path.join(PROFILE_ICONS_RELATIVE_PATH, new_filename)
        user.set_profile_icon(relative_path)
        db.session.commit()
        
        # 返回新头像的base64编码
        base64_icon = encode_image(icon_path)
        return jsonify({
            'message': '头像上传成功',
            'icon_path': relative_path,
            'icon_base64': base64_icon
        }), 200
        
    except Exception as e:
        print(f"上传头像失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 获取头像
@user_profile.route('/api/user/profile_icon', methods=['GET'])
@login_required
def get_profile_icon():
    try:
        if not verify_user_access(session['user_id']):
            return jsonify({'error': '无权访问'}), 403

        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': '用户未找到'}), 404
            
        icon_path = user.get_profile_icon()
        if not icon_path:
            # 返回默认头像
            default_icon_path = os.path.join('static', 'icons', 'users', 'default_profile.svg')
            return jsonify({
                'icon_path': default_icon_path,
                'is_default': True
            }), 200
            
        # 获取完整的文件路径
        full_path = os.path.join(current_app.root_path, icon_path)
        if not os.path.exists(full_path):
            # 如果文件不存在，返回默认头像
            default_icon_path = os.path.join('static', 'icons', 'users', 'default_profile.svg')
            return jsonify({
                'icon_path': default_icon_path,
                'is_default': True
            }), 200
            
        # 返回base64编码的图片
        base64_icon = encode_image(full_path)
        return jsonify({
            'icon_path': icon_path,
            'icon_base64': base64_icon,
            'is_default': False
        }), 200
        
    except Exception as e:
        print(f"获取头像失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 获取用户设置
@user_profile.route('/api/user/settings', methods=['GET'])
@login_required
def get_user_settings():
    try:
        if not verify_user_access(session['user_id']):
            return jsonify({'error': '无权访问'}), 403

        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': '用户未找到'}), 404
            
        return jsonify(user.get_settings()), 200
        
    except Exception as e:
        print(f"获取用户设置失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 更新用户设置
@user_profile.route('/api/user/settings', methods=['PUT'])
@login_required
def update_user_settings():
    try:
        if not verify_user_access(session['user_id']):
            return jsonify({'error': '无权访问'}), 403

        # 验证CSRF Token
        if request.headers.get('X-CSRF-Token') != session.get('csrf_token'):
            return jsonify({'error': 'CSRF验证失败'}), 403

        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': '用户未找到'}), 404
            
        new_settings = request.json
        if not new_settings:
            return jsonify({'error': '没有提供新的设置'}), 400

        # 验证设置数据
        allowed_settings = {'theme', 'language', 'notifications', 'message_sound'}
        if not all(key in allowed_settings for key in new_settings.keys()):
            return jsonify({'error': '包含无效的设置项'}), 400
            
        user.update_settings(new_settings)
        db.session.commit()
        
        return jsonify({
            'message': '设置更新成功',
            'settings': user.get_settings()
        }), 200
        
    except Exception as e:
        print(f"更新用户设置失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 获取用户显示名称
@user_profile.route('/api/user/display_name', methods=['GET'])
@login_required
def get_display_name():
    try:
        if not verify_user_access(session['user_id']):
            return jsonify({'error': '无权访问'}), 403

        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': '用户未找到'}), 404
            
        # 确保返回空字符串而不是 None
        display_name = user.display_name or ''
        print(f"获取用户显示名称: user_id={user.id}, display_name='{display_name}'")
        
        return jsonify({
            'display_name': display_name
        }), 200
        
    except Exception as e:
        print(f"获取用户名失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 更新用户显示名称
@user_profile.route('/api/user/display_name', methods=['PUT'])
@login_required
def update_display_name():
    try:
        print("开始处理更新显示名称请求")
        if not verify_user_access(session['user_id']):
            return jsonify({'error': '无权访问'}), 403

        # 验证CSRF Token
        csrf_token = request.headers.get('X-CSRF-Token')
        session_token = session.get('csrf_token')
        print(f"CSRF Token 验证: 请求={csrf_token}, 会话={session_token}")
        if csrf_token != session_token:
            return jsonify({'error': 'CSRF验证失败'}), 403

        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': '用户未找到'}), 404
            
        data = request.get_json()
        print(f"接收到的数据: {data}")
        if not isinstance(data, dict) or 'display_name' not in data:
            return jsonify({'error': '没有提供显示名称'}), 400
            
        # 处理显示名称
        display_name = data.get('display_name')
        print(f"准备更新显示名称: user_id={user.id}, old_name='{user.get_display_name()}', new_name='{display_name}'")
            
        if display_name is not None and len(str(display_name).strip()) > 50:
            return jsonify({'error': '显示名称不能超过50个字符'}), 400
            
        # 使用用户模型的方法更新显示名称
        try:
            user.set_display_name(display_name)
            db.session.commit()
            
            # 重新从数据库获取值以验证更新
            db.session.refresh(user)
            print(f"数据库更新后的值: '{user.get_display_name()}'")
            
            return jsonify({
                'message': '显示名称更新成功',
                'display_name': user.get_display_name()
            }), 200
            
        except Exception as e:
            db.session.rollback()
            print(f"数据库更新失败: {str(e)}")
            raise Exception(f"保存到数据库失败: {str(e)}")
        
    except Exception as e:
        print(f"更新用户名失败: {str(e)}")
        return jsonify({'error': str(e)}), 500 