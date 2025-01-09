from google.generativeai.types import HarmCategory, HarmBlockThreshold
import base64
import os
from flask import render_template, request, jsonify, Response, session, redirect, url_for, send_file
import json
from datetime import datetime, timezone, timedelta
import PIL.Image
from werkzeug.utils import secure_filename
import secrets
import traceback
import time

from config import AVAILABLE_MODELS
from config import RATE_LIMIT_WINDOW
from utils.files.file_config import ATTACHMENT_TYPES, AttachmentType

from initialization import app, db, mail, xai_client, deepseek_client,gemini_pool


from utils.user_model import User
from utils.conversation_model import Conversation

from utils.wrapper import login_required
from utils.email_vailder import check_rate_limit, generate_verification_code, send_verification_email

from utils.files.file_config import MIME_TYPE_MAPPING, AttachmentType
from utils.chat.message_processor import process_image_attachment, process_binary_attachment,process_video_attachment,process_image_attachment_by_ocr

from routes.user import user_profile
from routes.upload_status import upload_status_bp
from routes.user.settings import user_settings
from routes.image import image_bp  # 添加这行
from utils.price.sentence2token import TokenCounter
from utils.price.usage_model import Usage
from utils.image_handler import delete_base64_file, save_base64_locally
# 注册蓝图
app.register_blueprint(user_profile)
app.register_blueprint(user_settings)  # 注册用户设置蓝图
app.register_blueprint(upload_status_bp, url_prefix='/api/upload-status')
app.register_blueprint(image_bp, url_prefix='/api/image')  # 添加这行

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
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        user = User.query.filter_by(email=email).first()
        if not user or not user.verified:
            return jsonify({'error': '用户不存在或未验证'}), 404
            
        if not user.check_password(password):
            return jsonify({'error': '密码错误'}), 400
            
        session['user_id'] = user.id
        return jsonify({'message': '登录成功', 'redirect': url_for('home')}), 200
            
    return render_template('login.html')

# 登出路由
@app.route('/logout')
def logout():
    session.pop('user_id', None)
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
        print("=== 开始处理图片上传请求 ===")
        
        if 'image' not in request.files:
            return jsonify({'error': '没有提供图片'}), 400
        
        image = request.files['image']
        if image.filename == '':
            return jsonify({'error': '没有选择文件'}), 400

        # 基本验证
        validation_result = validate_image_file(image)
        if validation_result:
            return validation_result

        # 获取用户信息
        user = User.query.get(session.get('user_id'))
        if not user:
            return jsonify({'error': '用户未找到'}), 404

        # 准备文件路径
        file_path = prepare_file_path(image.filename, user)
        
        try:
            # 获取文件大小
            image.seek(0, 2)
            file_size = image.tell()
            image.seek(0)
            
            # 检查是否需要特殊处理（比如大图片压缩）
            needs_processing = file_size > 5 * 1024 * 1024  # 5MB
            
            if needs_processing:
                # 保存到临时目录
                temp_path = os.path.join(app.config['TEMP_FOLDER'], 
                    secure_filename(f"temp_{datetime.now().timestamp()}_{image.filename}"))
                image.save(temp_path)
                
                # 处理图片（压缩等）
                processed_path = process_image(temp_path, file_path)
                
                # 读取处理后的图片并转为base64
                with open(processed_path, 'rb') as img_file:
                    base64_image = base64.b64encode(img_file.read()).decode('utf-8')
                    
                # 清理临时文件
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                    
            else:
                # 直接保存小文件
                image.save(file_path)
                # 转换为base64
                with open(file_path, 'rb') as img_file:
                    base64_image = base64.b64encode(img_file.read()).decode('utf-8')
            
            # 保存 base64 数据到本地文件
            base64_id = save_base64_locally(base64_image, session['user_id'])
            
            return jsonify({
                'message': '图片上传成功',
                'file_path': file_path,
                'mime_type': image.content_type,
                'base64_id': base64_id
            })

        except Exception as e:
            print(f"保存文件时出错: {str(e)}")
            if os.path.exists(file_path):
                os.remove(file_path)
            raise

    except Exception as e:
        print(f"图片上传失败: {str(e)}")
        print(f"错误详情: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

def validate_image_file(image):
    """验证图片文件"""
    # 检查文件扩展名
    file_ext = os.path.splitext(image.filename)[1].lower()
    if file_ext not in ATTACHMENT_TYPES[AttachmentType.IMAGE]['extensions']:
        return jsonify({'error': f'不支持的图片格式: {file_ext}'}), 400
        
    # 检查MIME类型
    if image.content_type not in ATTACHMENT_TYPES[AttachmentType.IMAGE]['mime_types']:
        return jsonify({'error': f'不支持的图片格式: {image.content_type}'}), 400
        
    # 检查文件大小
    image.seek(0, 2)
    file_size = image.tell()
    image.seek(0)
    
    max_size = ATTACHMENT_TYPES[AttachmentType.IMAGE]['max_size']
    if file_size > max_size:
        return jsonify({'error': f'文件大小超过限制 ({max_size/(1024*1024)}MB)'}), 400
    
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
        return Response(status=200)
        
    data = request.json
    messages = data.get('messages', [])
    conversation_id = data.get('conversation_id')
    model_id = data.get('model_id', 'gemini-1.5-pro')
    user_id = session.get('user_id')
    temperature = data.get('temperature', 0.7)
    max_tokens = data.get('max_tokens', 4096)
    
    # 创建token计数器实例
    token_counter = TokenCounter()
    
    print(f"\n=== 聊天请求信息 ===")
    print(f"模型ID: {model_id}")
    print(f"会话ID: {conversation_id}")
    print(f"消息数量: {len(messages)}")
    print(f"用户ID: {user_id}")

    # 验证对话归属权
    if conversation_id:
        conversation = Conversation.query.filter_by(id=conversation_id, user_id=session['user_id']).first()
        if not conversation:
            return jsonify({'error': '对话不存在或无权访问'}), 404
            
    # 获取模型类型和支持的附件类型
    model_type = None
    model_support_list = []
    for provider, config in AVAILABLE_MODELS.items():
        for model in config['models']:
            if model['id'] == model_id:
                model_type = config['api_type']
                model_support_list = model['available_attachments']
                print(f"模型类型: {model_type}")
                print(f"支持的附件类型: {[str(t) for t in model_support_list]}")
                break
        if model_type:
            break
            
    if not model_type:
        return jsonify({'error': '不支持的模型'}), 400

    def process_message_with_attachments(message, model_type, model_support_list, user_id,genai):
        # 从配置中获取支持的图片类型
        from utils.files.file_config import MIME_TYPE_MAPPING, ATTACHMENT_TYPES, AttachmentType
        
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
                file_ext = os.path.splitext(file_path)[1].lower() if file_path else ''
                
                print(f"\n=== 附件信息 ===")
                print(f"附件类型: {attachment_type}")
                print(f"MIME类型: {mime_type}")
                print(f"文件路径: {file_path}")
                print(f"文件扩展名: {file_ext}")
                
                # 验证MIME类型是否在支持列表中
                if mime_type:
                    supported_type = MIME_TYPE_MAPPING.get(mime_type)
                    print(f"MIME类型映射结果: {supported_type}")
                    
                    # 首先判断是否为图片类型
                    is_image = (supported_type == AttachmentType.IMAGE and 
                              file_ext in ATTACHMENT_TYPES[AttachmentType.IMAGE]['extensions'] and 
                              mime_type in ATTACHMENT_TYPES[AttachmentType.IMAGE]['mime_types'])
                    
                    if is_image:
                        print("检测到图片文件")
                        # 检查模型是否支持图片处理
                        if AttachmentType.IMAGE in model_support_list:
                            print("模型支持图片处理，使用标准图片处理流程")
                            process_image_attachment(
                                attachment,
                                model_type,
                                processed_message,
                                supported_type,
                                mime_type,
                                genai
                            )
                        else:
                            print("模型不支持图片处理，使用OCR提取文本")
                            process_image_attachment_by_ocr(
                                attachment,
                                model_type,
                                processed_message,
                                user_id  # 传递用户ID
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
                        print(f"模型不支持的附件类型: {supported_type}")
                        print(f"模型支持的类型: {model_support_list}")
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
                                    AttachmentType.GEMINI_VIDEO,
                                    mime_type,
                                    genai
                                )
                            else:
                                print(f"视频格式不受Gemini支持: {file_ext}, {mime_type}")
                                process_binary_attachment(
                                    attachment,
                                    model_type,
                                    processed_message,
                                    AttachmentType.BINARY
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
                                AttachmentType.VIDEO,
                                mime_type,
                                genai
                            )
                    # 其他类型的附件处理
                    else:
                        process_binary_attachment(
                            attachment,
                            model_type,
                            processed_message,
                            supported_type
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
        
        return processed_message

    def generate():
        try:
            # 处理消息列表
            processed_messages = []
            for msg in messages:
                # 获取新的genai实例
                genai_instance, GenerativeModel = gemini_pool.get_client()
                processed_msg = process_message_with_attachments(
                    msg, 
                    model_type, 
                    model_support_list, 
                    user_id,
                    genai_instance
                )
                processed_messages.append(processed_msg)
            
            # 计算输入token数
            input_tokens, _ = token_counter.estimate_tokens(processed_messages)
            accumulated_output = []  # 用于累积输出文本
            
            if model_type == 'openai':
                # OpenAI 模型调用
                if model_id.startswith('deepseek'):
                    client = deepseek_client
                    # DeepSeek API 需要特殊处理消息格式
                    formatted_messages = []
                    for i, msg in enumerate(processed_messages):
                        print(f"处理第 {i} 条消息:", msg)  # 调试日志
                        
                        # 确保content是字符串
                        content = ''
                        if isinstance(msg.get('content'), str):
                            content = msg['content']
                        elif isinstance(msg.get('content'), list):
                            # 如果content是数组，提取所有文本
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
                        
                        formatted_msg = {
                            'role': msg['role'],
                            'content': content.strip()
                        }
                        print(f"格式化后的消息:", formatted_msg)  # 调试日志
                        formatted_messages.append(formatted_msg)
                    
                    print("最终发送给 DeepSeek 的消息:", formatted_messages)  # 调试日志
                    stream = client.chat.completions.create(
                        model=model_id,
                        messages=formatted_messages,
                        stream=True,
                        temperature=temperature,
                        max_tokens=max_tokens
                    )
                else:
                    client = xai_client
                    stream = client.chat.completions.create(
                        model=model_id,
                        messages=processed_messages,
                        stream=True,
                        temperature=temperature,
                        max_tokens=max_tokens
                    )

                for chunk in stream:
                    if hasattr(chunk.choices[0].delta, 'content') and chunk.choices[0].delta.content is not None:
                        content = chunk.choices[0].delta.content
                        accumulated_output.append(content)  # 累积输出文本
                        yield f"data: {json.dumps({'content': content})}\n\n"

            elif model_type == 'google':
                # Google 模型调用
                genai, GenerativeModel = gemini_pool.get_client()
                model = GenerativeModel(model_id)
                
                # 将消息转换为 Google SDK 格式
                formatted_history = []
                if model_id == 'gemini-exp-1206' or model_id == 'gemini-exp-1121' or model_id == 'learnlm-1.5-pro-experimental' :
                    for msg in processed_messages[:-1]:  # 除了最后一条消息
                        #暂时不适用系统词
                        if msg['role'] == 'system':
                            continue
                        message_parts = []
                        # 添加文本内容
                        if msg.get('content'):
                            message_parts.append({'text': msg['content']})
                        # 添加其他部分（如图片）
                        if 'parts' in msg:
                            message_parts.extend(msg['parts'])
                        
                        formatted_history.append({
                            'role': 'model' if msg['role'] == 'assistant' else 'user',
                            'parts': message_parts
                        })
                else:
                    for msg in processed_messages[:-1]:  # 除了最后一条消息
                        if msg['role'] == 'system':
                            # 将系统提示词转换为特殊的用户-助手对话
                            formatted_history.append({
                                'role': 'user',
                                'parts': [{'text': f"Instructions for your behavior: {msg.get('content', '')}"}]
                            })
                            formatted_history.append({
                                'role': 'assistant',
                                'parts': [{'text': 'I understand and will follow these instructions.'}]
                            })
                        else:
                            # 处理普通消息
                            message_parts = []
                            # 添加文本内容
                            if msg.get('content'):
                                message_parts.append({'text': msg['content']})
                            # 添加其他部分（如图片）
                            if 'parts' in msg:
                                message_parts.extend(msg['parts'])
                            
                            formatted_history.append({
                                'role': msg['role'],
                                'parts': message_parts
                            })
                
                # 创建聊天实例并传入历史记录
                chat = model.start_chat(history=formatted_history)
                
                # 获取并处理最后一条消息
                last_message = processed_messages[-1]
                last_message_parts = []
                
                # 添加文本内容
                if last_message.get('content'):
                    last_message_parts.append({'text': last_message['content']})
                
                # 添加其他部分（如图片）
                if 'parts' in last_message:
                    last_message_parts.extend(last_message['parts'])
                
                print("发送给Gemini的消息内容：", last_message_parts)
                
                try:
                    print("\n=== 开始发送消息到Gemini ===")
                    
                    # 获取新的genai实例用于生成配置
                    genai_instance, GenerativeModel = gemini_pool.get_client()
                    
                    safety_settings = {
                        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
                        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                    }
                    
                    print("\n=== 安全设置 ===")
                    for category, threshold in safety_settings.items():
                        print(f"{category}: {threshold}")
                    
                    # 使用新的配置创建聊天实例
                    chat = model.start_chat(
                        history=formatted_history
                    )
                    
                    try:
                        response = chat.send_message(
                            last_message_parts,
                            stream=True,
                            safety_settings=safety_settings,
                            generation_config=genai_instance.GenerationConfig(
                                max_output_tokens=max_tokens,
                                temperature=temperature,
                            )
                        )
                        print("成功获取响应流")
                        
                        for chunk in response:
                            print("\n=== 处理响应块 ===")
                            try:
                                # 处理安全评级
                                safety_ratings = None
                                if hasattr(chunk, 'candidates') and chunk.candidates:
                                    for candidate in chunk.candidates:
                                        if hasattr(candidate, 'safety_ratings'):
                                            safety_ratings = candidate.safety_ratings
                                            break
                                elif hasattr(chunk, 'safety_ratings'):
                                    safety_ratings = chunk.safety_ratings

                                if safety_ratings:
                                    print("\n=== 安全评级信息 ===")
                                    for rating in safety_ratings:
                                        category = str(rating.category).replace('HarmCategory.', '')
                                        probability = str(rating.probability)
                                        blocked = getattr(rating, 'blocked', False)
                                        
                                        print(f"类别: {category}")
                                        print(f"概率等级: {probability}")
                                        print(f"是否被阻止: {blocked}")
                                        print("---")
                                        
                                        # 如果内容被阻止，记录详细信息
                                        if blocked:
                                            print(f"警告：{category} 内容被阻止，概率等级：{probability}")

                                # 检查chunk的内容
                                if hasattr(chunk, 'text') and chunk.text:
                                    print(f"响应文本: {chunk.text}")
                                    accumulated_output.append(chunk.text)  # 累积输出文本
                                    yield f"data: {json.dumps({'content': chunk.text})}\n\n"
                                else:
                                    print("响应块没有文本内容")
                                    if hasattr(chunk, 'finish_reason'):
                                        print(f"完成原因: {chunk.finish_reason}")
                                    
                            except Exception as e:
                                print(f"处理响应块时出错: {str(e)}")
                                print(f"响应块内容: {dir(chunk)}")  # 打印chunk的所有属性
                                raise
                                
                    except Exception as e:
                        print(f"发送消息时出错: {str(e)}")
                        if "safety_ratings" in str(e):
                            print("\n=== 安全评级错误详情 ===")
                            error_str = str(e)
                            if "HARM_CATEGORY" in error_str:
                                # 解析并打印详细的安全评级信息
                                ratings_str = error_str[error_str.find("[category:"):]
                                print(f"详细安全评级: {ratings_str}")
                            yield f"data: {json.dumps({'error': '内容被安全系统拦截，这可能是由于内容涉及敏感话题。请尝试更委婉的表达方式。'})}\n\n"
                        else:
                            raise

                except Exception as e:
                    print(f"\n=== 发送消息时出错 ===")
                    print(f"错误类型: {type(e).__name__}")
                    print(f"错误信息: {str(e)}")
                    print("详细错误信息:")
                    traceback.print_exc()
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"

            # 计算输出token数并记录使用情况
            output_text = ''.join(accumulated_output)
            _, output_tokens = token_counter.estimate_tokens([{
                'role': 'assistant',
                'content': output_text
            }])
            
            try:
                with app.app_context():
                    # 记录使用情况
                    usage = Usage(
                        user_id=user_id,
                        model_name=model_id,
                        tokens_in=input_tokens,
                        tokens_out=output_tokens
                    )
                    usage.calculate_cost()  # 在添加到session之前计算成本
                    db.session.add(usage)
                    db.session.commit()
                    
                    # 打印使用统计
                    print("\n=== 使用统计 ===")
                    print(f"输入token数: {input_tokens}, 成本: ${usage.input_cost:.6f}")
                    print(f"输出token数: {output_tokens}, 成本: ${usage.output_cost:.6f}")
                    print(f"总成本: ${usage.total_cost:.6f}")
                    
                    # 发送最终的token统计信息
                    usage_info = {
                        'type': 'usage_info',
                        'input_tokens': input_tokens,
                        'output_tokens': output_tokens,
                        'total_tokens': input_tokens + output_tokens,
                        'input_cost': usage.input_cost,
                        'output_cost': usage.output_cost,
                        'total_cost': usage.total_cost
                    }
                yield f"data: {json.dumps(usage_info)}\n\n"
            except Exception as e:
                print(f"记录使用情况时出错: {str(e)}")
                db.session.rollback()

        except Exception as e:
            print(f"Error in generate(): {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

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
                max_tokens=max_tokens
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
        model_id = data.get('model_id', 'gemini-1.5-flash-8b')

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
        stream = xai_client.chat.completions.create(
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
        genai, GenerativeModel = gemini_pool.get_client()
        model = GenerativeModel(model_id)
        chat = model.start_chat(history=[])
        response = chat.send_message(messages[-1]['content'], stream=True)
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

def prepare_file_path(filename, user):
    """准备文件保存路径"""
    # 生成安全的文件名
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    original_filename = secure_filename(filename)
    ext = os.path.splitext(original_filename)[1]
    new_filename = f"{timestamp}{ext}"
    
    # 创建用户目录和 base64_store 子目录
    user_email = user.email.replace('@','_').replace('.','_')
    user_folder = os.path.join(app.config['UPLOAD_FOLDER'], user_email)
    base64_store = os.path.join(user_folder, 'base64_store')
    os.makedirs(user_folder, exist_ok=True)
    os.makedirs(base64_store, exist_ok=True)
    
    return os.path.join(user_folder, new_filename)

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