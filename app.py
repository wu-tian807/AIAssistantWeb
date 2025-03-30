from google.genai.types import HarmCategory, HarmBlockThreshold
from google.genai.types import Part,GenerateContentConfigDict,Content
import base64
import os
from flask import render_template, request, jsonify, Response, session, redirect, url_for, send_file
import json
from datetime import datetime, timezone, timedelta
from werkzeug.utils import secure_filename
import secrets
import traceback

from config import AVAILABLE_MODELS
from config import RATE_LIMIT_WINDOW
from utils.files.file_config import ATTACHMENT_TYPES, AttachmentType

from initialization import app, db, mail, xai_client, deepseek_client,gemini_pool,siliconcloud_client,oaipro_client,yunwu_client

from config import THINKING_MODELS_WITHOUT_CONTENT
from config import MODELS_WITHOUT_TOOL_SUPPORT
from config import THINKING_MODELS_WITH_THINKING_DEGREE
from utils.user_model import User, DEFAULT_USER_SETTINGS
from utils.conversation_model import Conversation

from utils.wrapper import login_required
from utils.email_vailder import check_rate_limit, generate_verification_code, send_verification_email

from utils.files.file_config import MIME_TYPE_MAPPING, AttachmentType
from utils.chat.message_processor import process_image_attachment, process_binary_attachment,process_video_attachment,process_image_attachment_by_ocr

# 导入工具相关模块
from utils.tool_wrapper import get_registered_tools, execute_tool
from tools.base_tools import get_current_time, get_date_info
from tools.tool_processor import get_tools, handle_tool_calls

from routes.user import user_profile
from routes.upload_status import upload_status_bp
from routes.user.settings import user_settings
from routes.image import image_bp  # 添加这行
from utils.price.tokenCounter import TokenCounter
from utils.price.usage_model import Usage
from utils.attachment_handler.image_handler import delete_base64_file, save_base64_locally, get_base64_by_id
from routes.upload_attachment_types import upload_attachment_types_bp
from routes.text.text_routes import text_bp  # 添加这行
from routes.generate_text import summary_bp  # 导入摘要生成蓝图
from routes.models_get import models_get_bp, model_icons_bp  # 导入模型相关蓝图
# 注册蓝图
app.register_blueprint(user_profile)
app.register_blueprint(user_settings)  # 注册用户设置蓝图
app.register_blueprint(upload_status_bp, url_prefix='/api/upload-status')
app.register_blueprint(image_bp, url_prefix='/api/image')  # 添加这行
app.register_blueprint(upload_attachment_types_bp)  # 注册附件类型蓝图
app.register_blueprint(text_bp, url_prefix='/api/text')  # 添加这行
app.register_blueprint(summary_bp, url_prefix='/api/summary')  # 注册摘要生成蓝图
app.register_blueprint(models_get_bp, url_prefix='/api/models')  # 注册模型蓝图
app.register_blueprint(model_icons_bp, url_prefix='/api/models')  # 注册模型图标蓝图

# 在每个请求之前生成CSRF Token
@app.before_request
def before_request():
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(16)

# 添加模板全局函数
@app.context_processor
def utility_processor():
    def csrf_token():
        if 'csrf_token' not in session:
            session['csrf_token'] = secrets.token_hex(16)
        return session['csrf_token']
    return dict(csrf_token=csrf_token)

# 修改注册路由
@app.route('/register', methods=['GET', 'POST'])
def register():
    # 如果用户已登录，直接跳转到首页
    if 'user_id' in session:
        if request.method == 'POST':
            return jsonify({'redirect': url_for('home')}), 200
        else:
            return redirect(url_for('home'))
        
    if request.method == 'POST':
        email = request.form.get('email')
        
        # 检查发送频率
        if not check_rate_limit(email):
            return jsonify({
                'error': f'发送太频繁，请在{RATE_LIMIT_WINDOW}秒后重试'
            }), 429
        
        # 检查邮箱是否已注册
        user = User.query.filter_by(email=email).first()
        if user and user.verified:
            return jsonify({'error': '该邮箱已注册'}), 400
            
        # 生成新的验证码
        code = generate_verification_code()
        code_timestamp = datetime.now(timezone.utc)
        
        if user:
            user.verification_code = code
            user.code_timestamp = code_timestamp
        else:
            user = User(email=email, verification_code=code, code_timestamp=code_timestamp)
            db.session.add(user)
            
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"数据库错误: {str(e)}")
            return jsonify({'error': '注册失败，请重试'}), 500
        
        # 发送验证码
        if send_verification_email(email, code):
            return jsonify({'message': '验证码已发送'}), 200
        else:
            return jsonify({'error': '验证码发送失败，请检查邮箱地址或稍后重试'}), 500
            
    return render_template('register.html')

# 修改验证路由中的时间比较
@app.route('/verify', methods=['POST'])
def verify():
    email = request.form.get('email')
    code = request.form.get('code')
    
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': '用户不存在'}), 404
        
    # 检查验证码是否过期（5分钟有效期）
    if user.code_timestamp is None:
        return jsonify({'error': '验证码已过期'}), 400
        
    current_time = datetime.now(timezone.utc)
    code_timestamp = user.code_timestamp.replace(tzinfo=timezone.utc)
    
    if current_time - code_timestamp > timedelta(minutes=5):
        return jsonify({'error': '验证码已过期'}), 400
        
    if user.verification_code != code:
        return jsonify({'error': '验证码错误'}), 400
        
    # 验证码正确，返回成功消息
    return jsonify({'message': '验证码正确'}), 200

# 添加设置密码路由
@app.route('/set_password', methods=['POST'])
def set_password():
    email = request.form.get('email')
    code = request.form.get('code')
    password = request.form.get('password')
    
    if not password or len(password) < 6:
        return jsonify({'error': '密码长度不能小于6位'}), 400
    
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': '用户不存在'}), 404
        
    # 再次验证验证码
    if user.verification_code != code:
        return jsonify({'error': '验证码错误'}), 400
        
    # 设置密码并标记为已验证
    user.set_password(password)
    user.verified = True
    db.session.commit()
    
    # 自动登录
    session['user_id'] = user.id
    return jsonify({'message': '注册成功', 'redirect': url_for('home')}), 200

# 修改登录路由为密码登录
@app.route('/login', methods=['GET', 'POST'])
def login():
    # 如果用户已登录，直接跳转到首页
    if 'user_id' in session:
        if request.method == 'POST':
            return jsonify({'redirect': url_for('home')}), 200
        else:
            return redirect(url_for('home'))
        
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        remember_me = request.form.get('remember_me') == 'true'
        
        user = User.query.filter_by(email=email).first()
        if not user or not user.verified:
            return jsonify({'error': '用户不存在或未验证'}), 404
            
        if not user.check_password(password):
            return jsonify({'error': '密码错误'}), 400
            
        session['user_id'] = user.id
        
        # 如果勾选了"保持登录"，设置会话的持久性
        if remember_me:
            # 默认 session 是在浏览器关闭后过期的
            # 这里将其设置为30天
            session.permanent = True
            app.permanent_session_lifetime = timedelta(days=30)
        else:
            session.permanent = False
            
        return jsonify({'message': '登录成功', 'redirect': url_for('home')}), 200
            
    return render_template('login.html')

# 添加检查登录状态的路由
@app.route('/check_login_status')
def check_login_status():
    if 'user_id' in session:
        return jsonify({'logged_in': True}), 200
    return jsonify({'logged_in': False}), 200

# 登出路由
@app.route('/logout')
def logout():
    # 清除用户ID
    session.pop('user_id', None)
    # 清除session的持久性设置
    session.permanent = False
    # 清除整个会话
    session.clear()
    return redirect(url_for('login'))

# 修改主页路由，添加登录验证
@app.route('/')
@login_required
def home():
    # 验证用户是否存在
    user = User.query.get(session['user_id'])
    if not user:
        session.clear()
        return redirect(url_for('login'))
    return render_template('chat.html', current_user=user)



@app.route('/upload_image', methods=['POST'])
@login_required
def upload_image():
    try:
        print("\n=== 开始处理图片上传请求 ===", flush=True)
        print(f"请求方法: {request.method}", flush=True)
        print(f"请求头: {dict(request.headers)}", flush=True)
        print(f"请求文件: {request.files}", flush=True)
        print(f"请求表单: {request.form}", flush=True)
        
        if 'image' not in request.files:
            print("错误：请求中没有图片文件", flush=True)
            return jsonify({'error': '没有提供图片'}), 400
        
        image = request.files['image']
        print(f"\n接收到的文件信息:", flush=True)
        print(f"文件名: {image.filename}", flush=True)
        print(f"Content-Type: {image.content_type}", flush=True)
        print(f"文件头部: {image.stream.read(16)}", flush=True)  # 读取文件头部来确认文件类型
        image.stream.seek(0)  # 重置文件指针
        
        if image.filename == '':
            print("错误：没有选择文件", flush=True)
            return jsonify({'error': '没有选择文件'}), 400

        # 基本验证
        print("\n执行文件验证...")
        validation_result = validate_image_file(image)
        if validation_result:
            print(f"验证失败: {validation_result[0].json}")
            return validation_result

        # 获取用户信息
        user = User.query.get(session.get('user_id'))
        if not user:
            print("错误：用户未找到")
            return jsonify({'error': '用户未找到'}), 404

        # 准备文件路径
        print("\n准备文件路径...")
        file_path = prepare_file_path(image.filename, user, image.content_type)
        
        try:
            # 获取文件大小
            image.seek(0, 2)
            file_size = image.tell()
            image.seek(0)
            print(f"\n文件大小: {file_size/(1024*1024):.2f}MB")
            
            # 检查是否需要特殊处理（比如大图片压缩）
            needs_processing = file_size > 5 * 1024 * 1024  # 5MB
            print(f"是否需要处理: {'是' if needs_processing else '否'}")
            
            if needs_processing:
                print("\n处理大文件...")
                # 保存到临时目录
                temp_path = os.path.join(app.config['TEMP_FOLDER'], 
                    secure_filename(f"temp_{datetime.now().timestamp()}_{image.filename}"))
                print(f"临时文件路径: {temp_path}")
                image.save(temp_path)
                
                # 处理图片（压缩等）
                processed_path = process_image(temp_path, file_path)
                print(f"处理后的文件路径: {processed_path}")
                
                # 读取处理后的图片并转为base64
                with open(processed_path, 'rb') as img_file:
                    base64_image = base64.b64encode(img_file.read()).decode('utf-8')
                    print("成功转换为base64")
                    
                # 清理临时文件
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                    print("已清理临时文件")
                    
            else:
                print("\n直接保存小文件...")
                image.save(file_path)
                print(f"文件已保存到: {file_path}")
                # 转换为base64
                with open(file_path, 'rb') as img_file:
                    base64_image = base64.b64encode(img_file.read()).decode('utf-8')
                    print("成功转换为base64")
            
            # 保存 base64 数据到本地文件
            print("\n保存base64数据...")
            base64_id = save_base64_locally(base64_image, session['user_id'])
            print(f"base64_id: {base64_id}")
            
            return jsonify({
                'message': '图片上传成功',
                'file_path': file_path,
                'mime_type': image.content_type,
                'base64_id': base64_id
            })

        except Exception as e:
            print(f"\n保存文件时出错: {str(e)}")
            print(f"错误详情:\n{traceback.format_exc()}")
            if os.path.exists(file_path):
                os.remove(file_path)
            raise

    except Exception as e:
        print(f"\n图片上传失败: {str(e)}")
        print(f"错误详情:\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

def validate_image_file(image):
    """验证图片文件"""
    print("\n=== 验证图片文件 ===")
    # 检查文件扩展名
    file_ext = os.path.splitext(image.filename)[1].lower()
    print(f"文件扩展名: {file_ext}")
    print(f"支持的扩展名: {ATTACHMENT_TYPES[AttachmentType.IMAGE]['extensions']}")
    
    if file_ext not in ATTACHMENT_TYPES[AttachmentType.IMAGE]['extensions']:
        print(f"不支持的文件扩展名: {file_ext}")
        return jsonify({'error': f'不支持的图片格式: {file_ext}'}), 400
        
    # 检查MIME类型
    print(f"文件MIME类型: {image.content_type}")
    print(f"支持的MIME类型: {ATTACHMENT_TYPES[AttachmentType.IMAGE]['mime_types']}")
    
    if image.content_type not in ATTACHMENT_TYPES[AttachmentType.IMAGE]['mime_types']:
        print(f"不支持的MIME类型: {image.content_type}")
        return jsonify({'error': f'不支持的图片格式: {image.content_type}'}), 400
        
    # 检查文件大小
    image.seek(0, 2)
    file_size = image.tell()
    image.seek(0)
    print(f"文件大小: {file_size/(1024*1024):.2f}MB")
    
    max_size = ATTACHMENT_TYPES[AttachmentType.IMAGE]['max_size']
    print(f"最大允许大小: {max_size/(1024*1024)}MB")
    
    if file_size > max_size:
        print(f"文件大小超过限制: {file_size/(1024*1024):.2f}MB > {max_size/(1024*1024)}MB")
        return jsonify({'error': f'文件大小超过限制 ({max_size/(1024*1024)}MB)'}), 400
    
    print("文件验证通过")
    return None

def process_image(temp_path, output_path):
    """处理大图片（压缩等）"""
    try:
        from PIL import Image
        import io
        
        # 打开图片
        with Image.open(temp_path) as img:
            # 保持宽高比进行压缩
            max_size = (1920, 1920)  # 最大尺寸
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # 保存压缩后的图片
            img.save(output_path, optimize=True, quality=85)
            
        return output_path
        
    except Exception as e:
        print(f"处理图片失败: {str(e)}")
        raise

@app.route('/chat', methods=['POST', 'GET'])
@login_required
def chat():
    if request.method == 'GET':
        return render_template('chat.html')

    data = request.json
    messages = data.get('messages', [])
    conversation_id = data.get('conversation_id')
    model_id = data.get('model_id', 'grok-2-latest')
    user_id = session.get('user_id')
    temperature = data.get('temperature', 0.7)
    max_tokens = data.get('max_tokens', 4096)
    reasoning_effort = data.get('reasoning_effort', 'high')  # 添加思考力度参数，默认为high
    
    # 添加工具调用参数
    enable_tools = data.get('enable_tools', True)  # 占位符，默认开启工具
    selected_tools = data.get('selected_tools', None)  # 用户选择的工具，默认为None表示使用所有工具
    
    # 从数据库获取用户设置
    user = User.query.get(user_id)
    enable_ocr = user.get_setting('enable_ocr', DEFAULT_USER_SETTINGS['enable_ocr']) if user else DEFAULT_USER_SETTINGS['enable_ocr']
    enhanced_visual = user.get_setting('enhanced_visual', DEFAULT_USER_SETTINGS['enhanced_visual']) if user else DEFAULT_USER_SETTINGS['enhanced_visual']

    print(f"\n=== 聊天请求信息 ===")
    print(f"模型ID: {model_id}")
    print(f"会话ID: {conversation_id}")
    print(f"消息数量: {len(messages)}")
    print(f"用户ID: {user_id}")
    print(f"OCR功能: {'启用' if enable_ocr else '禁用'}")
    print(f"思考力度: {reasoning_effort}")
    print(f"工具调用: {'启用' if enable_tools else '禁用'}")  # 添加日志
    # 验证对话归属权
    if conversation_id:
        conversation = Conversation.query.filter_by(id=conversation_id, user_id=session['user_id']).first()
        if not conversation:
            return jsonify({'error': '对话不存在或无权访问'}), 404
            
    # 获取模型类型和支持的附件类型
    model_type = None
    model_support_list = []
    is_reasoner = False
    for provider, config in AVAILABLE_MODELS.items():
        for model in config['models']:
            if model['id'] == model_id:
                model_type = config['api_type']
                model_support_list = model['available_attachments']
                is_reasoner = model.get('reasoner', False)
                print(f"模型类型: {model_type}")
                print(f"支持的附件类型: {[str(t) for t in model_support_list]}")
                break
        if model_type:
            break
            
    if not model_type:
        return jsonify({'error': '不支持的模型'}), 400

    # 检查模型是否支持工具调用
    supports_tools = model_id not in MODELS_WITHOUT_TOOL_SUPPORT
    if enable_tools and not supports_tools:
        print(f"警告: 模型 {model_id} 不支持工具调用，已禁用工具功能")
        enable_tools = False
        
    # 获取可用工具
    available_tools = []
    if enable_tools and supports_tools:
        # 不使用selected_tools参数，始终获取所有工具
        available_tools = get_tools(enable_tools)
        print(f"可用工具数量: {len(available_tools)}")
        for tool in available_tools:
            if 'function' in tool and 'name' in tool['function']:
                print(f"  - {tool['function']['name']}")
            else:
                print(f"  - {tool}")  # 工具格式可能不标准，直接打印
    
    # 移除消息历史转换逻辑，保持消息格式统一
    # 格式转换只在API调用前进行

    def process_message_with_attachments(message, model_type, model_support_list, user_id,enable_ocr,enhanced_visual):
        # 从配置中获取支持的图片类型
        from utils.files.file_config import MIME_TYPE_MAPPING, ATTACHMENT_TYPES, AttachmentType
        from utils.attachment_handler.image_handler import get_base64_by_id
        
        image_ocr_tokens = (0.0,0.0)
        # 创建新的消息对象，只复制必要的字段
        processed_message = {
            'role': message.get('role', ''),
        }
        
        # 根据模型类型初始化消息格式
        if model_type == 'openai':
            processed_message['content'] = []
            if message.get('content') and isinstance(message['content'], str):
                processed_message['content'].append({
                    "type": "text",
                    "text": message['content']
                })
        elif model_type == 'google':
            processed_message['parts'] = []
            # 确保始终添加文本内容，即使是空字符串
            text_content = message.get('content', '')
            if isinstance(text_content, str):
                if not text_content and 'attachments' in message:
                    # 如果没有文本但有附件，添加默认文本
                    text_content = "请分析以下附件内容："
                processed_message['parts'].append({
                    "text": text_content
                })
        
        # 处理消息中的附件
        if 'attachments' in message and message['attachments']:
            attachments = message['attachments']
            for attachment in attachments:
                # 获取附件类型和MIME类型
                attachment_type = attachment.get('type')
                mime_type = attachment.get('mime_type')
                file_path = attachment.get('file_path', '')
                
                # 优先使用attachment中的extension属性，如果没有再从文件路径提取
                file_ext = attachment.get('extension', '')
                if not file_ext and file_path:
                    file_ext = os.path.splitext(file_path)[1].lower()
                
                print(f"\n=== 附件信息 ===")
                print(f"附件类型: {attachment_type}")
                print(f"MIME类型: {mime_type}")
                print(f"文件路径: {file_path}")
                print(f"文件扩展名: {file_ext}")
                
                # 验证MIME类型是否在支持列表中
                if mime_type:
                    supported_type = MIME_TYPE_MAPPING.get(mime_type)
                    # 使用枚举的value_str属性输出更友好的字符串
                    print(f"MIME类型映射结果: {supported_type.value_str if supported_type else '未找到映射'}")
                    
                    # 首先判断是否为图片类型
                    is_image = (supported_type == AttachmentType.IMAGE and 
                              file_ext in ATTACHMENT_TYPES[AttachmentType.IMAGE]['extensions'] and 
                              mime_type in ATTACHMENT_TYPES[AttachmentType.IMAGE]['mime_types'])
                    
                    if is_image:
                        print("检测到图片文件")
                        # 检查模型是否支持图片处理
                        if AttachmentType.IMAGE in model_support_list:
                            print("模型支持图片处理，使用标准图片处理流程")
                            if model_type == 'openai':
                                # 获取 base64 数据
                                base64_data = None
                                if 'base64_id' in attachment:
                                    try:
                                        base64_data = get_base64_by_id(attachment['base64_id'], user_id)
                                        print("成功获取base64数据")
                                    except Exception as e:
                                        print(f"获取base64数据失败: {e}")
                                        continue
                                    
                                if base64_data:
                                    processed_message['content'].append({
                                        "type": "image_url",
                                        "image_url": {
                                            "url": f"data:{mime_type};base64,{base64_data}",
                                            "detail": "high"
                                        }
                                    })
                                    print(f"添加图片附件，MIME类型: {mime_type}")
                            else:
                                process_image_attachment(
                                    attachment,
                                    model_type,
                                    processed_message,
                                    AttachmentType.IMAGE,  # 使用枚举类型
                                    mime_type,
                                    user_id
                                )
                        else:
                            print("模型不支持图片处理，使用OCR提取文本")
                            image_ocr_tokens = process_image_attachment_by_ocr(
                                attachment,
                                model_type,
                                processed_message,
                                user_id,  # 传递用户ID
                                enable_ocr,  # 传递OCR功能状态
                                enhanced_visual  # 传递增强视觉分析状态
                            )
                        continue
                        
                    # 如果不是图片，再检查其他类型
                    if not supported_type:
                        supported_type = AttachmentType.BINARY
                        print(f"未找到MIME类型映射，使用默认类型: {supported_type}")
                        
                    # 检查模型是否支持该类型的附件
                    # 特殊处理视频类型：统一处理 VIDEO 和 GEMINI_VIDEO
                    if supported_type == AttachmentType.VIDEO:
                        if AttachmentType.VIDEO in model_support_list or AttachmentType.GEMINI_VIDEO in model_support_list:
                            print("检测到视频类型，模型支持视频处理")
                            # 如果是Gemini模型，将类型转换为GEMINI_VIDEO
                            if model_type == 'google':
                                supported_type = AttachmentType.GEMINI_VIDEO
                        else:
                            print(f"模型不支持视频类型，将作为二进制文件处理")
                            supported_type = AttachmentType.BINARY
                    elif supported_type not in model_support_list:
                        # 使用枚举的value_str属性输出更友好的字符串
                        print(f"模型不支持的附件类型: {supported_type.value_str if supported_type else '未知类型'}")
                        # 将模型支持的类型转换为更易读的格式
                        supported_types_str = [t.value_str for t in model_support_list]
                        print(f"模型支持的类型: {supported_types_str}")
                        supported_type = AttachmentType.BINARY
                        
                    # 处理视频附件（包括 VIDEO 和 GEMINI_VIDEO）
                    if supported_type in [AttachmentType.VIDEO, AttachmentType.GEMINI_VIDEO]:
                        print(f"处理视频附件: model_type={model_type}, file_ext={file_ext}, mime_type={mime_type}")
                        # 如果是Google模型，使用GEMINI_VIDEO配置
                        if model_type == 'google':
                            print(f"检查Gemini视频支持: extensions={ATTACHMENT_TYPES[AttachmentType.GEMINI_VIDEO]['extensions']}, mime_types={ATTACHMENT_TYPES[AttachmentType.GEMINI_VIDEO]['mime_types']}")
                            if (file_ext in ATTACHMENT_TYPES[AttachmentType.GEMINI_VIDEO]['extensions'] and 
                                mime_type in ATTACHMENT_TYPES[AttachmentType.GEMINI_VIDEO]['mime_types']):
                                print("视频格式符合Gemini要求，开始处理...")
                                process_video_attachment(
                                    attachment,
                                    model_type,
                                    processed_message,
                                    AttachmentType.GEMINI_VIDEO,  # 使用枚举类型
                                    mime_type
                                )
                            else:
                                print(f"视频格式不受Gemini支持: {file_ext}, {mime_type}")
                                process_binary_attachment(
                                    attachment,
                                    model_type,
                                    processed_message,
                                    AttachmentType.BINARY  # 使用枚举类型
                                )
                                if model_type == 'google':
                                    processed_message['parts'].append({
                                        "text": f"\n注意：该视频格式不受Gemini支持。\n支持的格式：{', '.join(ATTACHMENT_TYPES[AttachmentType.GEMINI_VIDEO]['extensions'])}"
                                    })
                        else:
                            # 非Google模型的视频处理
                            process_video_attachment(
                                attachment,
                                model_type,
                                processed_message,
                                AttachmentType.VIDEO,  # 使用枚举类型VIDEO
                                mime_type
                            )
                    # 检查是否为文本附件
                    elif supported_type == AttachmentType.TEXT:
                        print(f"处理文本附件: model_type={model_type}, file_ext={file_ext}, mime_type={mime_type}")
                        # 检查文件MIME类型是否符合文本文件要求
                        # 注意：对文本类型优先使用MIME类型判断，因为文件路径可能没有扩展名
                        if mime_type in ATTACHMENT_TYPES[AttachmentType.TEXT]['mime_types']:
                            print("文本MIME类型符合要求，开始处理...")
                            # 调用文本处理函数
                            from utils.chat.message_processor import process_text_attachment
                            process_text_attachment(
                                attachment,
                                model_type,
                                processed_message,
                                AttachmentType.TEXT,  # 使用枚举类型
                                mime_type,
                                user_id
                            )
                        else:
                            print(f"文本MIME类型不符合要求: {mime_type}")
                            process_binary_attachment(
                                attachment,
                                model_type,
                                processed_message,
                                AttachmentType.BINARY  # 使用枚举类型
                            )
                    # 其他类型的附件处理
                    else:
                        # 直接使用支持类型枚举值
                        process_binary_attachment(
                            attachment,
                            model_type,
                            processed_message,
                            supported_type  # 使用枚举类型
                        )
        
        # 如果是OpenAI模型且没有任何内容，添加一个空文本
        if model_type == 'openai' and not processed_message['content']:
            processed_message['content'].append({
                "type": "text",
                "text": ""
            })
            
        # 如果是Google模型且没有任何内容，添加一个空文本
        if model_type == 'google' and not processed_message['parts']:
            processed_message['parts'].append({
                "text": ""
            })
        
        return processed_message,image_ocr_tokens

    def generate():
        total_image_ocr_tokens = [0.0,0.0]
        try:
            # 处理消息列表
            processed_messages = []
            for msg in messages:
                processed_msg,image_ocr_tokens = process_message_with_attachments(
                    msg, 
                    model_type, 
                    model_support_list, 
                    user_id,
                    enable_ocr,
                    enhanced_visual
                )
                processed_messages.append(processed_msg)
                total_image_ocr_tokens[0] += image_ocr_tokens[0]
                total_image_ocr_tokens[1] += image_ocr_tokens[1]
            # 初始化token计数器和累积输出
            token_counter = TokenCounter()
            accumulated_output = []
            input_tokens = 0
            output_tokens = 0
            cached_input_tokens = 0
            use_estimated = True

            if model_type == 'openai':
                # OpenAI 模型调用
                formatted_messages_for_deepseek = []
                if model_id.startswith('deepseek'):
                    if provider == 'deepseek':
                        client = deepseek_client
                    elif provider == 'siliconcloud':
                        client = siliconcloud_client
                    for msg in processed_messages:
                        # 确保content是字符串
                        content = ''
                        if isinstance(msg.get('content'), str):
                            content = msg['content']
                        elif isinstance(msg.get('content'), list):
                            text_parts = []
                            for item in msg['content']:
                                if isinstance(item, dict):
                                    if item.get('type') == 'text':
                                        text_parts.append(item.get('text', ''))
                                    elif 'text' in item:
                                        text_parts.append(item['text'])
                                elif isinstance(item, str):
                                    text_parts.append(item)
                            content = ' '.join(text_parts)
                        
                        # 处理parts字段
                        if 'parts' in msg:
                            parts_content = []
                            for part in msg['parts']:
                                if isinstance(part, dict) and 'text' in part:
                                    parts_content.append(part['text'])
                                elif isinstance(part, str):
                                    parts_content.append(part)
                            if parts_content:
                                content = content + ' ' + ' '.join(parts_content)
                        
                        formatted_messages_for_deepseek.append({
                            'role': msg['role'],
                            'content': content.strip()
                        })
                    
                    print("发送给模型的消息:", formatted_messages_for_deepseek)
                else:
                    if provider == 'xai':
                        client = xai_client
                    elif provider == 'oaipro':
                        client = oaipro_client
                
                # 初始化token计数
                input_tokens_total = 0
                output_tokens_total = 0
                cached_input_tokens_total = 0
                
                # 移除工具调用自循环逻辑，一次只处理一轮对话
                print("\n=== 开始处理模型请求 ===")
                
                # 如果是思考模型但不返回思考内容，发送等待信号
                if model_id in THINKING_MODELS_WITHOUT_CONTENT:
                    print(f"发送 waiting_reasoning 数据，模型: {model_id}")
                    yield f"data: {json.dumps({'waiting_reasoning':True})}\n\n"
                    print("waiting_reasoning 数据已发送")
                
                # 创建基本参数
                params = {
                    "model": model_id,
                    "messages": formatted_messages_for_deepseek if len(formatted_messages_for_deepseek) > 0 else processed_messages,
                    "stream": True
                }
                
                # API调用前转换格式
                if enable_tools and supports_tools and available_tools:
                    # 导入转换函数
                    from tools.tool_processor import convert_tools_for_openai
                    # 一次性转换工具定义和消息
                    openai_config = convert_tools_for_openai(
                        tools=available_tools,
                        messages=params["messages"]
                    )
                    
                    # 更新工具配置
                    if "tool_config" in openai_config:
                        print(f"为OpenAI添加工具配置: {openai_config['tool_config']}")
                        params.update(openai_config["tool_config"])
                    
                    # 更新转换后的消息
                    if "converted_messages" in openai_config:
                        params["messages"] = openai_config["converted_messages"]
                
                # 根据模型类型添加不同的参数
                if model_id in THINKING_MODELS_WITHOUT_CONTENT:
                    # 推理模型使用max_completion_tokens
                    params["max_completion_tokens"] = max_tokens
                else:
                    # 普通模型使用max_tokens和temperature
                    params["max_tokens"] = max_tokens
                    params["temperature"] = temperature
                
                # 仅为支持思考力度的模型添加reasoning_effort参数
                if model_id in THINKING_MODELS_WITH_THINKING_DEGREE:
                    print(f"为模型 {model_id} 添加思考力度参数: {reasoning_effort}")
                    params["reasoning_effort"] = reasoning_effort
                
                # 调用模型API
                print(f"调用模型API，参数: {params}")
                stream = client.chat.completions.create(**params)

                # 使用新的流处理函数
                from utils.chat.stream_processor import process_stream_response
                # 处理流式响应并获取最后一个chunk
                generator, get_last_chunk = process_stream_response(stream, is_reasoner, accumulated_output)
                
                # 提供响应
                for response_chunk in generator:
                    # 发送响应到前端
                    yield response_chunk
                
                # 获取最后一个响应chunk用于token统计
                last_response = get_last_chunk()
                if last_response and hasattr(last_response, 'usage') and last_response.usage is not None:
                    try:
                        usage_dict = last_response.usage
                        if usage_dict and hasattr(usage_dict, 'prompt_tokens'):
                            current_input_tokens = usage_dict.prompt_tokens - (usage_dict.prompt_tokens_details.cached_tokens if hasattr(usage_dict, 'prompt_tokens_details') and usage_dict.prompt_tokens_details else 0)
                            current_output_tokens = usage_dict.completion_tokens if hasattr(usage_dict, 'completion_tokens') else 0
                            current_cached_input_tokens = usage_dict.prompt_tokens_details.cached_tokens if hasattr(usage_dict, 'prompt_tokens_details') and usage_dict.prompt_tokens_details else 0
                            
                            input_tokens_total += current_input_tokens
                            output_tokens_total += current_output_tokens
                            cached_input_tokens_total += current_cached_input_tokens
                            
                            use_estimated = False
                            print(f"从OpenAI响应获取到token数 - 输入: {current_input_tokens}, 输出: {current_output_tokens}, 缓存输入: {current_cached_input_tokens}")
                    except Exception as e:
                        print(f"从OpenAI响应获取token数时出错: {e}")
                        print(f"完整的usage信息: {last_response.usage if hasattr(last_response, 'usage') else 'None'}")
                        use_estimated = True
                else:
                    print("无法从OpenAI响应获取token数，使用tiktoken估算")
                    use_estimated = True
                
                # 设置最终的token计数
                input_tokens = input_tokens_total
                output_tokens = output_tokens_total
                cached_input_tokens = cached_input_tokens_total
                
                if use_estimated:
                    # 使用tiktoken计算token数量
                    print(f"使用tiktoken计算{model_id}的token数")
                    
                    # 针对OpenAI模型格式进行预处理
                    formatted_messages_for_token = []
                    for msg in processed_messages:
                        formatted_msg = {'role': msg.get('role', 'user')}
                        
                        # 处理内容为列表的情况
                        if 'content' in msg and isinstance(msg['content'], list):
                            text_content = []
                            for item in msg['content']:
                                if isinstance(item, dict) and item.get('type') == 'text':
                                    text_content.append(item.get('text', ''))
                            formatted_msg['content'] = ' '.join(text_content)
                        elif 'content' in msg:
                            formatted_msg['content'] = msg['content']
                        else:
                            formatted_msg['content'] = ''
                            
                        formatted_messages_for_token.append(formatted_msg)
                    
                    print(f"格式化后的消息数量: {len(formatted_messages_for_token)}")
                    # 估算输入token
                    input_tokens = token_counter.estimate_message_tokens(formatted_messages_for_token, model_id)[0]
                    
                    print(f"输入token数: {input_tokens}")
                    # 估算输出token
                    output_text = ''.join(accumulated_output)
                    output_tokens = token_counter.estimate_completion_tokens(output_text, model_id)
                    print(f"Token计算结果 - 输入: {input_tokens}, 输出: {output_tokens}")
            
            elif model_type == 'google':
                # Google 模型调用
                genai_client = gemini_pool.get_client()
                
                # 检查是否是思考模型，如果是则发送waiting_reasoning信号
                if model_id in THINKING_MODELS_WITHOUT_CONTENT:
                    print(f"发送 waiting_reasoning 数据，模型: {model_id}")
                    yield f"data: {json.dumps({'waiting_reasoning':True})}\n\n"
                    print("waiting_reasoning 数据已发送")
                
                # 将消息转换为 Google SDK 格式，采用新的格式标准
                formatted_history = []
                system_instruction = ""
                for msg in processed_messages[:-1]:  # 除了最后一条消息
                    #处理系统提示词
                    if msg['role'] == 'system':
                        counter = 0
                        for part in msg['parts']:
                            system_instruction += "system_instruction {}:".format(counter)
                            counter += 1
                            if isinstance(part, dict) and 'text' in part:
                                system_instruction += part['text']
                    else:
                        # 处理普通消息
                        message_parts = []
                        # 添加内容
                        for part in msg['parts']:  # 修复：将part的定义移到这里
                            if isinstance(part, dict):
                                if 'text' in part:
                                    # 添加文本内容，保持原有的role格式 f"{msg['role']}:{part['text']}
                                    message_parts.append(Content(role=msg['role'],parts=[Part(text=part['text'])]))
                                elif 'inline_data' in part:
                                    # 添加附件内容，附件为字典结构
                                    message_parts.append(Part.from_bytes(data=part['inline_data']['data'], mime_type=part['inline_data']['mime_type']))
                            else:
                                # 添加附件内容，附件非字典结构
                                message_parts.append(part)
                        formatted_history.extend(message_parts)
                #print("formatted_history："+str(formatted_history))
                # 创建聊天实例并传入历史记录
                chat = genai_client.chats.create(model=model_id,history=formatted_history)
                
                # 获取并处理最后一条消息
                last_message = processed_messages[-1]
                last_message_parts = []
                
                # 添加所有的消息，包括文字和附件
                if 'parts' in last_message:
                    last_message_parts.extend(last_message['parts'])
                
                print("发送给Gemini的消息内容：", last_message_parts)
                
                try:
                    print("\n=== 开始发送消息到Gemini ===")
                    
                    
                    safety_settings_list = [
                        {'category': HarmCategory.HARM_CATEGORY_HATE_SPEECH, 'threshold': HarmBlockThreshold.BLOCK_NONE},
                        {'category': HarmCategory.HARM_CATEGORY_HARASSMENT, 'threshold': HarmBlockThreshold.BLOCK_NONE},
                        {'category': HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, 'threshold': HarmBlockThreshold.BLOCK_NONE},
                        {'category': HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, 'threshold': HarmBlockThreshold.BLOCK_NONE},
                    ]
                    
                    print("\n=== 安全设置 ===")
                    for setting in safety_settings_list:
                        print(f"类别: {setting['category'].name}, 阈值: {setting['threshold'].name}")
                    
                    # 创建配置对象
                    config = GenerateContentConfigDict(
                        system_instruction=system_instruction,
                        max_output_tokens=max_tokens,
                        temperature=temperature,
                        safety_settings=safety_settings_list
                    )
                    
                    # 如果支持工具且已启用工具，添加工具参数
                    if enable_tools and supports_tools and available_tools:
                        # 导入转换函数
                        from tools.tool_processor import convert_tools_for_google
                        # 一次性转换工具定义和消息
                        google_config = convert_tools_for_google(
                            tools=available_tools,
                            messages=formatted_history
                        )
                        
                        # 更新工具配置
                        if "tool_config" in google_config:
                            print(f"为Google/Gemini添加工具配置: {google_config['tool_config']}")
                            config.update(google_config["tool_config"])
                        
                        # 使用转换后的历史记录创建聊天实例
                        if "converted_messages" in google_config:
                            chat = genai_client.chats.create(model=model_id, history=google_config["converted_messages"])
                        else:
                            chat = genai_client.chats.create(model=model_id, history=formatted_history)

                    response = chat.send_message_stream(
                        message=last_message_parts,
                        config=config
                    )
                    print("成功获取响应流")
                    
                    # 使用新的流处理函数
                    from utils.chat.stream_processor import process_google_stream_response
                    # 处理流式响应并获取最后一个chunk
                    generator, get_last_chunk = process_google_stream_response(response, accumulated_output)

                    # 提供响应
                    for response_chunk in generator:
                        # 发送响应到前端
                        yield response_chunk

                    # 获取最后一个响应chunk用于token统计
                    last_response = get_last_chunk()

                    # 从最后一个响应中获取token使用情况
                    if last_response and hasattr(last_response, 'usage_metadata'):
                        input_tokens = last_response.usage_metadata.prompt_token_count
                        output_tokens = last_response.usage_metadata.candidates_token_count
                        use_estimated = False  # 更新为使用实际值
                        print(f"从Gemini响应获取到token数 - 输入: {input_tokens}, 输出: {output_tokens}")
                    else:
                        print("无法从Gemini响应获取token数，使用tiktoken估算")
                        use_estimated = True  # 更新为使用预估值
                        # 使用tiktoken估算token数
                        input_tokens = token_counter.estimate_message_tokens(processed_messages,model_id)[0]
                        output_text = ''.join(accumulated_output)
                        output_tokens = token_counter.estimate_completion_tokens(output_text,model_id)
                    
                except Exception as e:
                    error_msg = f"与Gemini通信时出错: {str(e)}"
                    print(f"\n=== 错误信息 ===")
                    print(f"类型: {type(e).__name__}")
                    print(f"描述: {str(e)}")
                    print("详细堆栈:")
                    import traceback
                    print(traceback.format_exc())
                    error_response = {
                        'error': error_msg,
                        'error_type': type(e).__name__,
                        'status_code': 500
                    }
                    yield f"data: {json.dumps(error_response)}\n\n"
            
        except Exception as e:
            error_msg = f"记录使用情况时出错: {str(e)}"
            print(error_msg)
            print(f"错误详情:\n{traceback.format_exc()}")
            db.session.rollback()
            error_response = {
                'error': error_msg,
                'error_type': 'DatabaseError',
                'status_code': 500
            }
            yield f"data: {json.dumps(error_response)}\n\n"

        with app.app_context():
            usage = Usage(
                user_id=user_id,
                model_name=model_id,
                tokens_in=input_tokens,
                cached_input_tokens=cached_input_tokens,
                tokens_out=output_tokens,
                image_ocr_input_tokens=total_image_ocr_tokens[0],
                image_ocr_output_tokens=total_image_ocr_tokens[1]
            )
            usage.calculate_cost()
            db.session.add(usage)
            db.session.commit()
            
            print("\n=== 使用统计 ===")
            print(f"Token计数方式: {'tiktoken预估' if use_estimated else '模型实际值'}")
            print(f"输入token数: {input_tokens}, 命中缓存token数: {cached_input_tokens}, 成本: ${usage.input_cost:.6f}")
            print(f"输出token数: {output_tokens}, 成本: ${usage.output_cost:.6f}")
            print(f"图片OCR输入token数: {total_image_ocr_tokens[0]}, 图片OCR输出token数: {total_image_ocr_tokens[1]}, 成本: ${usage.image_ocr_cost:.6f}")
            print(f"总成本: ${usage.total_cost:.6f}")
            
            usage_info = {
                'type': 'usage_info',
                'input_tokens': input_tokens,
                'output_tokens': output_tokens,
                'total_tokens': input_tokens + output_tokens,
                'image_ocr_cost': usage.image_ocr_cost,
                'input_cost': usage.input_cost,
                'output_cost': usage.output_cost,
                'total_cost': usage.total_cost,
                'is_estimated': use_estimated,
                'status_code': 200
            }
            yield f"data: {json.dumps(usage_info)}\n\n"

    return Response(generate(), mimetype='text/event-stream')

# 添加重置密码路由
@app.route('/reset_password', methods=['GET', 'POST'])
def reset_password():
    if request.method == 'POST':
        email = request.form.get('email')
        
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({'error': '该邮箱未注册'}), 404
            
        # 生成新的验证码
        code = generate_verification_code()
        user.verification_code = code
        user.code_timestamp = datetime.now(timezone.utc)
        db.session.commit()
        
        # 发送验证码
        try:
            send_verification_email(email, code)
            return jsonify({'message': '验证码已发送'}), 200
        except Exception as e:
            print(f"邮件发送错误: {str(e)}")
            return jsonify({'error': '验证码发送失败'}), 500
            
    return render_template('reset_password.html')

# 添加确认重置密码路由
@app.route('/reset_password_confirm', methods=['POST'])
def reset_password_confirm():
    email = request.form.get('email')
    code = request.form.get('code')
    password = request.form.get('password')
    
    if not password or len(password) < 6:
        return jsonify({'error': '密码长度不能小于6位'}), 400
    
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': '用户不存在'}), 404
        
    # 验证验证码
    if user.verification_code != code:
        return jsonify({'error': '验证码错误'}), 400
        
    # 检查验证码是否过期
    if datetime.now(timezone.utc) - user.code_timestamp > timedelta(minutes=5):
        return jsonify({'error': '验证码已过期'}), 400
        
    # 更新密码
    user.set_password(password)
    db.session.commit()
    
    return jsonify({'message': '密码重置成功', 'redirect': url_for('login')}), 200

# 添加API路由
@app.route('/api/conversations', methods=['GET'])
@login_required
def get_conversations():
    conversations = Conversation.query.filter_by(user_id=session['user_id']).order_by(Conversation.updated_at.desc()).all()
    return jsonify({
        'conversations': [conv.to_dict() for conv in conversations]
    })

@app.route('/api/conversations', methods=['POST'])
@login_required
def save_conversations():
    data = request.json
    conversation_data = data.get('conversation')  # 改为单个对话
    operation = data.get('operation', 'update')  # 添加操作类型
    temperature = data.get('temperature')  # 移除默认值，使用数据库的默认值
    max_tokens = data.get('max_tokens')  # 移除默认值，使用数据库的默认值
    model_id = data.get('model_id')
    reasoning_effort = data.get('reasoning_effort', 'high')  # 添加思考力度参数
    
    try:
        if operation == 'create':
            # 创建新对话
            conversation = Conversation(
                id=conversation_data['id'],
                title=conversation_data['title'],
                messages=conversation_data['messages'],
                system_prompt=conversation_data.get('systemPrompt'),
                user_id=session['user_id'],
                temperature=temperature,
                max_tokens=max_tokens,
                reasoning_effort=reasoning_effort  # 添加思考力度
            )
            db.session.add(conversation)
            
        elif operation == 'update':
            # 更新现有对话
            conversation = Conversation.query.filter_by(
                id=conversation_data['id'], 
                user_id=session['user_id']
            ).first()
            
            if conversation:
                conversation.title = conversation_data['title']
                conversation.messages = conversation_data['messages']
                conversation.system_prompt = conversation_data.get('systemPrompt')
                # 只在提供了新值时更新
                if temperature is not None:
                    conversation.temperature = temperature
                if max_tokens is not None:
                    conversation.max_tokens = max_tokens
                if reasoning_effort is not None:
                    conversation.reasoning_effort = reasoning_effort  # 更新思考力度
            
        elif operation == 'delete':
            # 删除对话
            Conversation.query.filter_by(
                id=conversation_data['id'], 
                user_id=session['user_id']
            ).delete()
        
        db.session.commit()
        return jsonify({'message': '保存成功'})
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"保存对话失败: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/conversations/<conversation_id>', methods=['DELETE'])
@login_required
def delete_conversation(conversation_id):
    conversation = Conversation.query.filter_by(id=conversation_id, user_id=session['user_id']).first()
    if not conversation:
        return jsonify({'error': '对话不存在'}), 404
        
    try:
        # 删除相关的本地文件和 base64 文件
        for message in conversation.messages:
            if 'attachments' in message and message['attachments']:
                for attachment in message['attachments']:
                    # 删除本地文件
                    file_path = attachment.get('file_path')
                    if file_path and os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                            print(f"已删除文件: {file_path}")
                        except Exception as e:
                            print(f"删除文件失败 {file_path}: {str(e)}")
                            
                    # 删除 base64 文件
                    base64_id = attachment.get('base64_id')
                    if base64_id:
                        try:
                            delete_base64_file(base64_id, session['user_id'])
                            print(f"已删除 base64 文件: {base64_id}")
                        except Exception as e:
                            print(f"删除 base64 文件失败 {base64_id}: {str(e)}")
        
        db.session.delete(conversation)
        db.session.commit()
        return jsonify({'message': '删除成功'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# 添加获取可用模型列表的API
@app.route('/api/models', methods=['GET'])
@login_required
def get_models():
    try:
        # 创建可序列化的模型配置副本
        serializable_models = {}
        for provider, config in AVAILABLE_MODELS.items():
            provider_config = {
                'api_type': config['api_type'],
                'models': []
            }
            
            for model in config['models']:
                # 将 AttachmentType 转换为字符串列表
                available_attachments = [str(att.value) for att in model['available_attachments']]
                serializable_model = {
                    'id': model['id'],
                    'name': model['name'],
                    'description': model['description'],
                    'available_attachments': available_attachments,
                    'max_output_tokens': model['max_output_tokens']
                }
                
                # 添加reasoner属性，如果存在
                if 'reasoner' in model:
                    serializable_model['reasoner'] = model['reasoner']
                
                provider_config['models'].append(serializable_model)
                
            serializable_models[provider] = provider_config
            
        return jsonify(serializable_models)
    except Exception as e:
        app.logger.error(f"获取模型列表时出错: {str(e)}")
        return jsonify({'error': f'获取模型列表失败: {str(e)}'}), 500

# 创建数据库表
with app.app_context():
    db.create_all()

# 测试邮件连接
try:
    with app.app_context():
        with mail.connect() as conn:
            print("邮件服务器连接成功")
except Exception as e:
    print(f"邮件服务器连接失败: {str(e)}")

# 添加生成标题的路由
@app.route('/generate_title', methods=['POST'])
def generate_title():
    try:
        data = request.get_json()
        first_message = data.get('message')
        model_id = data.get('model_id', 'grok-2-latest')

        def generate():
            prompt = f"请根据用户的第一句话生成一个简短的、有趣的对话标题（不超过20个字）。用户的话是：{first_message}"
            
            for chunk in stream_chat_response_for_title([{
                "role": "user",
                "content": prompt
            }], model_id):
                if chunk:
                    yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"

        return Response(generate(), mimetype='text/event-stream')

    except Exception as e:
        print(f"生成标题时出错: {str(e)}")
        return jsonify({'error': str(e)}), 500

def stream_chat_response_for_title(messages, model_id):
    # 确定模型类型
    model_type = None
    for provider, config in AVAILABLE_MODELS.items():
        for model in config['models']:
            if model['id'] == model_id:
                model_type = config['api_type']
                break
        if model_type:
            break

    if model_type == 'openai':
        # OpenAI 模型调用
        if model_id.startswith('grok'):
            stream = xai_client.chat.completions.create(
                model=model_id,
                messages=messages,
                stream=True,
                temperature=0.7
            )
        elif model_id.startswith('deepseek'):
            stream = deepseek_client.chat.completions.create(
                model=model_id,
                messages=messages,
                stream=True,
                temperature=0.7
            )
        for chunk in stream:
            if hasattr(chunk.choices[0].delta, 'content') and chunk.choices[0].delta.content is not None:
                yield chunk.choices[0].delta.content

    elif model_type == 'google':
        # Google 模型调用
        genai_client = gemini_pool.get_client()
        response = genai_client.models.generate_content_stream(model=model_id, contents=messages[-1]['content'],config=GenerateContentConfigDict(temperature=0.7))
        for chunk in response:
            if chunk.text:
                yield chunk.text

@app.route('/get_image')
@login_required
def get_image():
    try:
        # 获取图片路径参数
        image_path = request.args.get('path')
        if not image_path:
            return jsonify({'error': '未提供图片路径'}), 400
            
        # 获取当前用户
        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': '用户未登录'}), 401
            
        # 验证路径是否属于当前用户的上传目录
        user_email = user.email.replace('@', '_').replace('.', '_')
        user_folder = os.path.join(app.config['UPLOAD_FOLDER'], user_email)
        
        # 确保请求的文件路径在用户的上传目录中
        requested_path = os.path.abspath(image_path)
        if not requested_path.startswith(os.path.abspath(user_folder)):
            return jsonify({'error': '无权访问该文件'}), 403
            
        # 检查文件是否存在
        if not os.path.exists(requested_path):
            return jsonify({'error': '文件不存在'}), 404
            
        # 获取文件的MIME类型
        import mimetypes
        mime_type = mimetypes.guess_type(requested_path)[0]
        
        # 如果无法猜测MIME类型，使用文件扩展名进行判断
        if not mime_type:
            file_ext = os.path.splitext(requested_path)[1].lower()
            # 常见图片扩展名到MIME类型的映射
            ext_to_mime = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp'
            }
            mime_type = ext_to_mime.get(file_ext, 'application/octet-stream')
        
        # 检查是否为支持的图片类型
        if MIME_TYPE_MAPPING.get(mime_type) == AttachmentType.IMAGE:
            return send_file(requested_path, mimetype=mime_type)
        else:
            return jsonify({'error': '不支持的文件类型'}), 415
        
    except Exception as e:
        print(f"获取图片失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/upload_video', methods=['POST'])
@login_required
def upload_video():
    try:
        print("=== 开始处理视频上传请求 ===")
        
        if 'video' not in request.files:
            return jsonify({'error': '没有提供视频'}), 400
        
        video = request.files['video']
        if video.filename == '':
            return jsonify({'error': '没有选择文件'}), 400

        # 基本验证
        validation_result = validate_video_file(video)
        if validation_result:
            return validation_result

        # 获取用户信息
        user = User.query.get(session.get('user_id'))
        if not user:
            return jsonify({'error': '用户未找到'}), 404

        # 准备文件路径
        user_email = user.email.replace('@','_').replace('.','_')
        user_folder = os.path.join(app.config['UPLOAD_FOLDER'], user_email)
        os.makedirs(user_folder, exist_ok=True)

        # 生成文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = secure_filename(f"{timestamp}_{video.filename}")
        file_path = os.path.join(user_folder, filename)

        try:
            # 直接保存文件
            video.save(file_path)
            
            return jsonify({
                'message': '视频上传成功',
                'file_path': file_path,
                'mime_type': video.content_type
            }), 200

        except Exception as e:
            print(f"保存文件时出错: {str(e)}")
            if os.path.exists(file_path):
                os.remove(file_path)
            raise

    except Exception as e:
        print(f"视频上传失败: {str(e)}")
        print(f"错误详情: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

def validate_video_file(video):
    """验证视频文件"""
    # 检查文件扩展名
    file_ext = os.path.splitext(video.filename)[1].lower()
    if file_ext not in ATTACHMENT_TYPES[AttachmentType.VIDEO]['extensions']:
        return jsonify({'error': f'不支持的视频格式: {file_ext}'}), 400
        
    # 检查MIME类型
    if video.content_type not in ATTACHMENT_TYPES[AttachmentType.VIDEO]['mime_types']:
        return jsonify({'error': f'不支持的视频格式: {video.content_type}'}), 400
        
    # 检查文件大小
    video.seek(0, 2)
    file_size = video.tell()
    video.seek(0)
    
    max_size = ATTACHMENT_TYPES[AttachmentType.VIDEO]['max_size']
    if file_size > max_size:
        return jsonify({'error': f'文件大小超过限制 ({max_size/(1024*1024)}MB)'}), 400
    
    return None

@app.route('/api/upload_to_file_api', methods=['POST'])
@login_required
def process_large_file():
    try:
        data = request.json
        temp_path = data.get('tempPath')
        
        if not temp_path or not os.path.exists(temp_path):
            return jsonify({'error': '临时文件不存在'}), 400
            
        try:
            # 获取用户信息
            user = User.query.get(session.get('user_id'))
            if not user:
                return jsonify({'error': 'User not found'}), 404

            # 准备最终的文件路径
            final_path = prepare_file_path(os.path.basename(temp_path), user)
            
            # 处理大文件（这里可以添加具体的处理逻辑）
            process_result = process_video_file(temp_path, final_path)
            
            return jsonify({
                'message': 'File processed successfully',
                'file_path': final_path,
                'process_result': process_result
            }), 200
            
        finally:
            # 清理临时文件
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
    except Exception as e:
        print(f"处理大文件失败: {str(e)}")
        print(f"错误详情: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

def prepare_file_path(filename, user, mime_type=None):
    """准备文件保存路径"""
    print("\n=== 文件路径准备 ===")
    print(f"原始文件名: {filename}")
    print(f"MIME类型: {mime_type}")
    
    # 先获取原始文件的扩展名
    original_ext = os.path.splitext(filename)[1].lower()
    print(f"原始扩展名: {original_ext}")
    
    # 生成安全的文件名
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    print(f"时间戳: {timestamp}")
    
    new_filename = f"{timestamp}{original_ext}"
    print(f"新文件名: {new_filename}")
    
    # 创建用户目录和 base64_store 子目录
    user_email = user.email.replace('@','_').replace('.','_')
    user_folder = os.path.join(app.config['UPLOAD_FOLDER'], user_email)
    base64_store = os.path.join(user_folder, 'base64_store')
    os.makedirs(user_folder, exist_ok=True)
    os.makedirs(base64_store, exist_ok=True)
    
    final_path = os.path.join(user_folder, new_filename)
    print(f"最终路径: {final_path}")
    
    return final_path

def process_video_file(temp_path, final_path):
    """处理大视频文件"""
    try:
        # 这里可以添加视频处理逻辑
        # 例如：压缩、转码等
        
        # 暂时只是移动文件
        import shutil
        shutil.move(temp_path, final_path)
        
        return {
            'status': 'success',
            'message': '文件处理完成'
        }
    except Exception as e:
        print(f"处理视频文件失败: {str(e)}")
        raise

@app.route('/get_video')
@login_required
def get_video():
    try:
        video_path = request.args.get('path')
        if not video_path:
            return jsonify({'error': '未提供视频路径'}), 400
            
        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': '用户未登录'}), 401
            
        user_email = user.email.replace('@', '_').replace('.', '_')
        user_folder = os.path.join(app.config['UPLOAD_FOLDER'], user_email)
        
        requested_path = os.path.abspath(video_path)
        if not requested_path.startswith(os.path.abspath(user_folder)):
            return jsonify({'error': '无权访问该文件'}), 403
            
        if not os.path.exists(requested_path):
            return jsonify({'error': '文件不存在'}), 404
            
        import mimetypes
        mime_type = mimetypes.guess_type(requested_path)[0]
        
        if not mime_type:
            file_ext = os.path.splitext(requested_path)[1].lower()
            ext_to_mime = {
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.ogg': 'video/ogg'
            }
            mime_type = ext_to_mime.get(file_ext, 'application/octet-stream')
        
        if mime_type.startswith('video/'):
            return send_file(requested_path, mimetype=mime_type)
        else:
            return jsonify({'error': '不支持的文件类型'}), 415
        
    except Exception as e:
        print(f"获取视频失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 启动应用
if __name__ == '__main__':
    app.run(debug=True)