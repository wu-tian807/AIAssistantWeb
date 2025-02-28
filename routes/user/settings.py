from flask import Blueprint, request, jsonify, session
from utils.wrapper import login_required
from utils.user_model import User, db, DEFAULT_USER_SETTINGS

# 创建蓝图
user_settings = Blueprint('user_settings', __name__)

def verify_user_access(user_id):
    """验证用户访问权限"""
    if 'user_id' not in session:
        return False
    return session['user_id'] == user_id

@user_settings.route('/api/user/settings/image_compression', methods=['GET'])
@login_required
def get_image_compression_setting():
    """获取图片压缩设置"""
    try:
        if not verify_user_access(session['user_id']):
            return jsonify({'error': '无权访问'}), 403

        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': '用户未找到'}), 404
            
        compression_enabled = user.get_setting('image_compression', DEFAULT_USER_SETTINGS['image_compression'])
        return jsonify({
            'image_compression': compression_enabled
        }), 200
        
    except Exception as e:
        print(f"获取图片压缩设置失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@user_settings.route('/api/user/settings/image_compression', methods=['PUT'])
@login_required
def update_image_compression_setting():
    """更新图片压缩设置"""
    try:
        if not verify_user_access(session['user_id']):
            return jsonify({'error': '无权访问'}), 403

        # 验证CSRF Token
        if request.headers.get('X-CSRF-Token') != session.get('csrf_token'):
            return jsonify({'error': 'CSRF验证失败'}), 403

        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': '用户未找到'}), 404
            
        data = request.get_json()
        if not isinstance(data, dict) or 'image_compression' not in data:
            return jsonify({'error': '无效的请求数据'}), 400
            
        compression_enabled = bool(data['image_compression'])
        user.set_setting('image_compression', compression_enabled)
        db.session.commit()
        
        # 刷新用户数据以确保更新成功
        db.session.refresh(user)
        current_setting = user.get_setting('image_compression')
        
        return jsonify({
            'message': '图片压缩设置更新成功',
            'image_compression': current_setting
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"更新图片压缩设置失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@user_settings.route('/api/user/settings/dark_theme', methods=['GET'])
@login_required
def get_dark_theme_setting():
    """获取夜间主题设置"""
    try:
        if not verify_user_access(session['user_id']):
            return jsonify({'error': '无权访问'}), 403

        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': '用户未找到'}), 404
            
        dark_theme_enabled = user.get_setting('dark_theme', DEFAULT_USER_SETTINGS['dark_theme'])
        return jsonify({
            'dark_theme': dark_theme_enabled
        }), 200
        
    except Exception as e:
        print(f"获取夜间主题设置失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@user_settings.route('/api/user/settings/dark_theme', methods=['PUT'])
@login_required
def update_dark_theme_setting():
    """更新夜间主题设置"""
    try:
        if not verify_user_access(session['user_id']):
            return jsonify({'error': '无权访问'}), 403

        # 验证CSRF Token
        if request.headers.get('X-CSRF-Token') != session.get('csrf_token'):
            return jsonify({'error': 'CSRF验证失败'}), 403

        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': '用户未找到'}), 404
            
        data = request.get_json()
        if not isinstance(data, dict) or 'dark_theme' not in data:
            return jsonify({'error': '无效的请求数据'}), 400
            
        dark_theme_enabled = bool(data['dark_theme'])
        user.set_setting('dark_theme', dark_theme_enabled)
        db.session.commit()
        
        # 刷新用户数据以确保更新成功
        db.session.refresh(user)
        current_setting = user.get_setting('dark_theme')
        
        return jsonify({
            'message': '夜间主题设置更新成功',
            'dark_theme': current_setting
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"更新夜间主题设置失败: {str(e)}")
        return jsonify({'error': str(e)}), 500
#添加是否开启非视觉模型的OCR功能
@user_settings.route('api/user/settings/ocr_model', methods=['GET'])
@login_required
def get_ocr_model_setting():
    """获取OCR模型设置"""
    try:
        if not verify_user_access(session['user_id']):
            return jsonify({'error': '无权访问'}), 403
        
        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': '用户未找到'}), 404
            
        enable_ocr = user.get_setting('enable_ocr', DEFAULT_USER_SETTINGS['enable_ocr'])
        return jsonify({
            'enable_ocr': enable_ocr
        }), 200
        
    except Exception as e:
        print(f"获取OCR模型设置失败: {str(e)}")
        return jsonify({'error': str(e)}), 500
#更新是否开启非视觉模型的OCR功能
@user_settings.route('api/user/settings/ocr_model', methods=['PUT'])
@login_required
def update_ocr_model_setting():
    """更新OCR模型设置"""
    try:
        if not verify_user_access(session['user_id']):
            return jsonify({'error': '无权访问'}), 403
        
        # 验证CSRF Token
        if request.headers.get('X-CSRF-Token') != session.get('csrf_token'):
            return jsonify({'error': 'CSRF验证失败'}), 403
        
        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': '用户未找到'}), 404
            
        data = request.get_json()
        if not isinstance(data, dict) or 'enable_ocr' not in data:
            return jsonify({'error': '无效的请求数据'}), 400
            
        enable_ocr = bool(data['enable_ocr'])
        user.set_setting('enable_ocr', enable_ocr)
        db.session.commit()

        # 刷新用户数据以确保更新成功
        db.session.refresh(user)
        current_setting = user.get_setting('enable_ocr')
        
        return jsonify({
            'message': 'OCR模型设置更新成功',
            'enable_ocr': current_setting
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"更新OCR模型设置失败: {str(e)}")