import base64
import os
from flask import render_template, request, jsonify, Response, session, redirect, url_for, send_file
import json
from datetime import datetime, timezone, timedelta
import PIL.Image
from werkzeug.utils import secure_filename

from config import AVAILABLE_MODELS
from config import RATE_LIMIT_WINDOW

from initialization import app, db, mail, xai_client, genai


from utils.user_model import User
from utils.conversation_model import Conversation

from utils.wrapper import login_required
from utils.email_vailder import check_rate_limit, generate_verification_code, send_verification_email

from utils.image_handler import encode_image

from utils.files.files_extension_helper import get_image_extension
from utils.files.file_config import MIME_TYPE_MAPPING, AttachmentType
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
    model_id = data.get('model_id', 'grok-2-vision-1212')  # 默认模型
    
    # 验证对话归属权
    if conversation_id:
        conversation = Conversation.query.filter_by(id=conversation_id, user_id=session['user_id']).first()
        if not conversation:
            return jsonify({'error': '对话不存在或无权访问'}), 404

    def process_message_with_attachments(message, model_type):
        # 从配置中获取支持的图片类型
        from utils.files.file_config import MIME_TYPE_MAPPING
        from config import ATTACHMENT_TYPES
        
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
            if message.get('content'):
                processed_message['parts'].append({
                    "text": message['content']
                })
        
        # 处理消息中的附件
        if 'attachments' in message and message['attachments']:
            attachments = message['attachments']
            for attachment in attachments:
                # 获取附件类型和MIME类型
                attachment_type = attachment.get('type')
                mime_type = attachment.get('mime_type')
                
                # 验证MIME类型是否在支持列表中
                if mime_type:
                    supported_type = MIME_TYPE_MAPPING.get(mime_type)
                    if not supported_type:
                        continue  # 跳过不支持的MIME类型
                        
                    # 检查文件扩展名是否支持
                    file_name = attachment.get('fileName', '')
                    file_ext = os.path.splitext(file_name)[1].lower()
                    
                    # 对于图片类型的特殊处理
                    if supported_type == 'image':
                        if (file_ext not in ATTACHMENT_TYPES['images']['extensions'] or 
                            mime_type not in ATTACHMENT_TYPES['images']['mime_types']):
                            continue
                            
                        if attachment.get('base64'):
                            has_attachments = True
                            if model_type == 'openai':
                                # 添加图片内容
                                attachment_text = f"[附件[Image]: {attachment.get('fileName', '未命名文件')}]"
                                processed_message['content'].append({
                                    "type": "text",
                                    "text": attachment_text
                                })
                                processed_message['content'].append({
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:{mime_type};base64,{attachment['base64']}"
                                    }
                                })
                            elif model_type == 'google':
                                # 获取图片大小
                                image_size = len(attachment['base64']) * 3 / 4  # Base64解码后的大致大小
                                
                                if image_size <= 20 * 1024 * 1024:  # 20MB以下
                                    # 尝试使用本地文件路径
                                    local_path = attachment.get('file_path')
                                    attachment_text = f"[附件[{supported_type}]: {attachment.get('fileName', '未命名文件')}]"
                                    if local_path and os.path.exists(local_path):
                                        try:
                                            image = PIL.Image.open(local_path)
                                            processed_message['parts'].append({
                                                "text": attachment_text
                                            })
                                            processed_message['parts'].append(image)
                                        except Exception as e:
                                            print(f"无法打开本地图片文件: {str(e)}")
                                            # 如果本地文件打开失败，回退到使用base64
                                            processed_message['parts'].append({
                                                "text": attachment_text
                                            })
                                            processed_message['parts'].append({
                                                "inline_data": {
                                                    "mime_type": mime_type,
                                                    "data": attachment['base64']
                                                }
                                            })
                                    else:
                                        # 如果没有本地文件路径或文件不存在，使用base64
                                        processed_message['parts'].append({
                                            "text": attachment_text
                                        })
                                        processed_message['parts'].append({
                                            "inline_data": {
                                                "mime_type": mime_type,
                                                "data": attachment['base64']
                                            }
                                        })
                                else:  # 大于20MB使用File API
                                    # 将base64转换为文件数据
                                    file_data = base64.b64decode(attachment['base64'])
                                    # 上传到File API并获取URI
                                    file_uri = genai.upload_file(file_data)
                                    attachment_text = f"[附件[{supported_type}]: {attachment.get('fileName', '未命名文件')}]"
                                    processed_message['parts'].append({
                                        "text": attachment_text
                                    })
                                    processed_message['parts'].append({
                                        "file_data": {
                                            "mime_type": mime_type,
                                            "file_uri": file_uri
                                        }
                                    })
                    # 其他类型的附件处理（未来扩展）
                    else:
                        attachment_text = f"[附件: {attachment.get('fileName', '未命名文件')}]"
                        if model_type == 'openai':
                            processed_message['content'].append({
                                "type": "text",
                                "text": attachment_text
                            })
                        elif model_type == 'google':
                            processed_message['parts'].append({
                                "text": attachment_text
                            })
        
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
            # 确定模型类型
            model_type = None
            for provider, config in AVAILABLE_MODELS.items():
                for model in config['models']:
                    if model['id'] == model_id:
                        model_type = config['api_type']
                        break
                if model_type:
                    break

            # 处理消息列表
            processed_messages = [
                process_message_with_attachments(msg, model_type) for msg in messages
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
    return jsonify(AVAILABLE_MODELS)

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

        if not first_message:
            return jsonify({'error': '消息不能为空'}), 400

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

# 启动应用
if __name__ == '__main__':
    app.run(debug=True)