import base64
import os
from flask import render_template, request, jsonify, Response, session, redirect, url_for, send_file
import json
from datetime import datetime, timezone, timedelta
import PIL.Image
from werkzeug.utils import secure_filename

from config import AVAILABLE_MODELS
from config import RATE_LIMIT_WINDOW
from utils.files.file_config import ATTACHMENT_TYPES, AttachmentType

from initialization import app, db, mail, xai_client, genai


from utils.user_model import User
from utils.conversation_model import Conversation

from utils.wrapper import login_required
from utils.email_vailder import check_rate_limit, generate_verification_code, send_verification_email

from utils.image_handler import encode_image

from utils.files.files_extension_helper import get_image_extension
from utils.files.file_config import MIME_TYPE_MAPPING, AttachmentType
from utils.chat.message_processor import process_image_attachment, process_binary_attachment,process_video_attachment

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
    return render_template('chat.html')



@app.route('/upload_image',methods=['POST'])
@login_required
def upload_image():
    try:
        if 'image' not in request.files:
            print("No image in request.files")
            return jsonify({'error': 'No image provided'}), 400
        
        image = request.files['image']
        if image.filename == '':
            print("No selected filename")
            return jsonify({'error': 'No selected file'}), 400

        # 获取当前用户的 user_id
        user_id = session.get('user_id')
        if not user_id:
            print("User not logged in")
            return jsonify({'error': 'User not logged in'}), 401
            
        user = User.query.get(user_id)
        if not user:
            print("User not found")
            return jsonify({'error': 'User not found'}), 404
        
        # 处理文件名：添加时间戳
        original_filename = secure_filename(image.filename)
        if not original_filename:
            print("Invalid filename")
            return jsonify({'error': 'Invalid filename'}), 400
        ext = get_image_extension(original_filename,image)
        
        # 生成新文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        new_filename = f"{timestamp}{ext}"
        
        # 保存图片到本地
        user_email = user.email.replace('@','_').replace('.','_')
        user_folder = os.path.join(app.config['UPLOAD_FOLDER'], user_email)
        os.makedirs(user_folder, exist_ok=True)

        # 保存图片到用户目录
        image_path = os.path.join(user_folder, new_filename)
        print(f"Saving image to: {image_path}")
        image.save(image_path)

        # 转换图片到base64
        try:
            base64_image = encode_image(image_path)
            return jsonify({
                'base64_image': base64_image,
                'message': 'Image uploaded successfully',
                'file_path': image_path
            }), 200
        except Exception as e:
            print(f"Error encoding image: {str(e)}")
            return jsonify({'error': 'Error processing image'}), 500

    except Exception as e:
        print(f"Upload error: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/chat', methods=['POST', 'GET'])
@login_required
def chat():
    if request.method == 'GET':
        return Response(status=200)
        
    data = request.json
    messages = data.get('messages', [])
    conversation_id = data.get('conversation_id')
    model_id = data.get('model_id', 'gemini-1.5-pro')  # 修改默认模型为gemini-1.5-pro
    
    print(f"\n=== 聊天请求信息 ===")
    print(f"模型ID: {model_id}")
    print(f"会话ID: {conversation_id}")
    print(f"消息数量: {len(messages)}")
    
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

    def process_message_with_attachments(message, model_type, model_support_list):
        # 从配置中获取支持的图片类型
        from utils.files.file_config import MIME_TYPE_MAPPING, ATTACHMENT_TYPES, AttachmentType
        
        processed_message = message.copy()
        has_attachments = False
        
        # 初始化消息格式
        if model_type == 'openai':
            processed_message['content'] = []
            if message.get('content'):
                processed_message['content'].append({
                    "type": "text",
                    "text": message['content']
                })
        elif model_type == 'google':
            processed_message['parts'] = []
            # 确保始终添加文本内容，即使是空字符串
            text_content = message.get('content', '')
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
                    if not supported_type:
                        supported_type = AttachmentType.BINARY
                        print(f"未找到MIME类型映射，使用默认类型: {supported_type}")
                        
                    # 检查模型是否支持该类型的附件
                    # 特殊处理视频类型：如果模型支持GEMINI_VIDEO，也视为支持VIDEO
                    if (supported_type == AttachmentType.VIDEO and 
                        AttachmentType.GEMINI_VIDEO in model_support_list):
                        print("检测到视频类型，模型支持GEMINI_VIDEO，允许处理")
                    elif supported_type not in model_support_list:
                        print(f"模型不支持的附件类型: {supported_type}")
                        print(f"模型支持的类型: {model_support_list}")
                        supported_type = AttachmentType.BINARY
                        
                    # 对于图片类型的特殊处理
                    if supported_type == AttachmentType.IMAGE:
                        if (file_ext not in ATTACHMENT_TYPES[AttachmentType.IMAGE]['extensions'] or 
                            mime_type not in ATTACHMENT_TYPES[AttachmentType.IMAGE]['mime_types']):
                            print(f"图片格式不受支持: {file_ext}, {mime_type}")
                            supported_type = AttachmentType.BINARY
                            continue
                            
                        process_image_attachment(
                            attachment,
                            model_type,
                            processed_message,
                            supported_type,
                            mime_type,
                            genai
                        )
                    #视频附件处理:
                    elif supported_type == AttachmentType.VIDEO:
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
                                processed_message['parts'].append({
                                    "text": f"\n注意：该视频格式不受Gemini支持。\n支持的格式：{', '.join(ATTACHMENT_TYPES[AttachmentType.GEMINI_VIDEO]['extensions'])}"
                                })
                        else:
                            process_video_attachment(
                                attachment,
                                model_type,
                                processed_message,
                                supported_type,
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
            processed_messages = [
                process_message_with_attachments(msg, model_type, model_support_list) for msg in messages
            ]
            
            if model_type == 'openai':
                # OpenAI 模型调用
                stream = xai_client.chat.completions.create(
                    model=model_id,
                    messages=processed_messages,
                    stream=True,
                    temperature=0.7
                )

                for chunk in stream:
                    if hasattr(chunk.choices[0].delta, 'content') and chunk.choices[0].delta.content is not None:
                        content = chunk.choices[0].delta.content
                        yield f"data: {json.dumps({'content': content})}\n\n"

            elif model_type == 'google':
                # Google 模型调用
                model = genai.GenerativeModel(model_id)
                
                # 将消息转换为 Google SDK 格式
                formatted_history = []
                if model_id == 'gemini-exp-1206' or model_id == 'gemini-exp-1121' or model_id == 'learnlm-1.5-pro-experimental' :
                    for msg in processed_messages[:-1]:  # 除了最后一条消息
                        if msg['role'] == 'system':
                            #暂时不适用系统词
                            continue
                        else:
                            # 处理普通消息
                            formatted_history.append({
                                'role': msg['role'] == 'assistant' if 'model' else msg['role'],
                                'parts': msg.get('parts', [{'text': msg.get('content', '')}])
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
                            formatted_history.append({
                                'role': msg['role'],
                                'parts': msg.get('parts', [{'text': msg.get('content', '')}])
                            })
                
                # 创建聊天实例并传入历史记录
                chat = model.start_chat(history=formatted_history)
                
                # 获取并处理最后一条消息
                last_message = processed_messages[-1]
                last_message_parts = last_message.get('parts', [{'text': last_message.get('content', '')}])
                
                # 发送消息并获取流式响应
                response = chat.send_message(last_message_parts, stream=True)

                for chunk in response:
                    if chunk.text:
                        yield f"data: {json.dumps({'content': chunk.text})}\n\n"

            else:
                yield f"data: {json.dumps({'error': '不支持的模型类型'})}\n\n"

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
    conversations_data = data.get('conversations', [])
    
    # 获取当前用户的所有对话并构建字典 {conv_id: conv_object}
    current_conversations = {
        conv.id: conv for conv in Conversation.query.filter_by(user_id=session['user_id']).all()
    }
    
    # 分别处理更新和创建
    updated_ids = set()
    try:
        for conv_data in conversations_data:
            conv_id = conv_data.get('id')
            if not conv_id:
                continue
            
            title = conv_data.get('title', '新对话')
            messages = conv_data.get('messages', [])
            system_prompt = conv_data.get('systemPrompt')  # 获取系统提示词
            
            if conv_id in current_conversations:
                # 更新现有对话
                conv = current_conversations[conv_id]
                conv.title = title
                conv.messages = messages
                conv.system_prompt = system_prompt  # 更新系统提示词
                updated_ids.add(conv_id)
            else:
                # 创建新对话
                new_conv = Conversation(
                    id=conv_id,
                    title=title,
                    messages=messages,
                    system_prompt=system_prompt,  # 设置系统提示词
                    user_id=session['user_id']
                )
                db.session.add(new_conv)
        
        # 删除不存在于新数据中的旧对话
        obsolete_ids = set(current_conversations.keys()) - updated_ids
        if obsolete_ids:
            Conversation.query.filter(
                Conversation.id.in_(obsolete_ids),
                Conversation.user_id == session['user_id']
            ).delete(synchronize_session=False)
        
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
        db.session.delete(conversation)
        db.session.commit()
        return jsonify({'message': '删除成功'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/conversations/<conversation_id>/switch', methods=['POST'])
@login_required
def switch_conversation(conversation_id):
    conversation = Conversation.query.filter_by(id=conversation_id, user_id=session['user_id']).first()
    if not conversation:
        return jsonify({'error': '对话不存在'}), 404
    return jsonify({'message': '切换成功'})

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
                    'available_attachments': available_attachments
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
        model = genai.GenerativeModel(model_id)
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
        print("开始处理视频上传请求")
        
        if 'video' not in request.files:
            print("请求中没有视频文件")
            return jsonify({'error': 'No video provided'}), 400
        
        video = request.files['video']
        print(f"接收到的文件信息: 文件名={video.filename}, MIME类型={video.content_type}")
        
        if video.filename == '':
            print("没有选择文件")
            return jsonify({'error': 'No selected file'}), 400

        # 检查文件扩展名
        file_ext = os.path.splitext(video.filename)[1].lower()
        print(f"文件扩展名: {file_ext}")
        if file_ext not in ATTACHMENT_TYPES[AttachmentType.VIDEO]['extensions']:
            print(f"不支持的文件扩展名: {file_ext}")
            print(f"支持的扩展名列表: {ATTACHMENT_TYPES[AttachmentType.VIDEO]['extensions']}")
            return jsonify({'error': f'不支持的视频格式: {file_ext}'}), 400
            
        # 检查MIME类型
        if video.content_type not in ATTACHMENT_TYPES[AttachmentType.VIDEO]['mime_types']:
            print(f"不支持的MIME类型: {video.content_type}")
            print(f"支持的MIME类型列表: {ATTACHMENT_TYPES[AttachmentType.VIDEO]['mime_types']}")
            return jsonify({'error': f'不支持的视频格式: {video.content_type}'}), 400

        user_id = session.get('user_id')
        if not user_id:
            print("用户未登录")
            return jsonify({'error': 'User not logged in'}), 401
            
        user = User.query.get(user_id)
        if not user:
            print("找不到用户")
            return jsonify({'error': 'User not found'}), 404
        
        # 处理文件名
        original_filename = secure_filename(video.filename)
        if not original_filename:
            print(f"文件名不安全: {video.filename}")
            return jsonify({'error': 'Invalid filename'}), 400
            
        # 检查文件大小
        video.seek(0, 2)  # 移动到文件末尾
        file_size = video.tell()  # 获取文件大小
        video.seek(0)  # 移动回文件开头
        
        print(f"文件大小: {file_size} 字节")
        max_size = ATTACHMENT_TYPES[AttachmentType.VIDEO]['max_size']
        print(f"最大允许大小: {max_size} 字节")
        
        if file_size > max_size:
            print(f"文件太大: {file_size} 字节, 超过限制: {max_size} 字节")
            return jsonify({'error': f'文件大小超过限制 ({max_size/(1024*1024)}MB)'}), 400
            
        # 生成新文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        ext = os.path.splitext(original_filename)[1]
        new_filename = f"{timestamp}{ext}"
        
        # 保存视频到用户目录
        user_email = user.email.replace('@','_').replace('.','_')
        user_folder = os.path.join(app.config['UPLOAD_FOLDER'], user_email)
        os.makedirs(user_folder, exist_ok=True)

        # 确保路径是字符串类型
        video_path = str(os.path.join(user_folder, new_filename))
        print(f"正在保存视频到: {video_path}")
        
        # 保存文件
        try:
            video.save(video_path)
            print(f"视频文件保存成功")
        except Exception as e:
            print(f"保存文件时出错: {str(e)}")
            raise
        
        print(f"视频上传成功: {video_path}")
        return jsonify({
            'message': 'Video uploaded successfully',
            'file_path': video_path,
            'mime_type': video.content_type
        }), 200

    except Exception as e:
        print(f"视频上传失败: {str(e)}")
        import traceback
        print(f"错误详情: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

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