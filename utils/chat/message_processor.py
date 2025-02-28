import os
import base64
import time
import PIL.Image
from typing import Dict, Any
from flask import session
from utils.files.file_config import ATTACHMENT_TYPES, AttachmentType
from routes.upload_status import send_status
from initialization import gemini_pool

def check_file_exists(file_path: str, mime_type: str = None) -> tuple:
    """
    检查文件是否已经存在于Gemini服务器
    
    Args:
        file_path: 本地文件路径
        mime_type: 文件的MIME类型（可选）
        
    Returns:
        tuple: (是否存在, 文件对象或None)
    """
    try:
        # 获取本地文件信息
        local_file_size = os.path.getsize(file_path)
        local_file_name = os.path.basename(file_path)
        local_file_ext = os.path.splitext(local_file_name)[1].lower()
            
        print(f"\n=== 文件匹配检查 ===")
        print(f"本地文件: {file_path}")
        print(f"文件大小: {local_file_size} 字节")
        print(f"文件扩展名: {local_file_ext}")
        print(f"MIME类型: {mime_type}")
        
        # 尝试从缓存文件中读取已上传文件的信息
        cache_file = os.path.join(os.path.dirname(file_path), '.gemini_files_cache.txt')
        current_time = time.time()
        cache_expiry = 48 * 3600  # 48小时的秒数
        valid_cache_entries = []
        cached_file = None
        
        if os.path.exists(cache_file):
            print("\n检查本地缓存...")
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        try:
                            # 格式: file_path|uri|mime_type|timestamp
                            parts = line.strip().split('|')
                            if len(parts) >= 4:
                                cached_path, cached_uri, cached_mime, timestamp = parts[:4]
                                timestamp = float(timestamp)
                                
                                # 检查是否过期
                                if current_time - timestamp > cache_expiry:
                                    print(f"缓存条目已过期: {cached_path}")
                                    continue
                                    
                                # 保存有效的缓存条目
                                valid_cache_entries.append(line.strip())
                                
                                # 检查是否匹配当前文件
                                if (os.path.normpath(cached_path) == os.path.normpath(file_path) and 
                                    (not mime_type or cached_mime == mime_type)):
                                    print(f"在缓存中找到匹配: {cached_uri}")
                                    remote_file = client.files.get(cached_uri.split('/')[-1])
                                    if remote_file and remote_file.state.name == "ACTIVE":
                                        print("远程文件状态正常")
                                        cached_file = remote_file
                        except (ValueError, IndexError):
                            continue
                            
                # 重写缓存文件，只保留有效条目
                os.makedirs(os.path.dirname(cache_file), exist_ok=True)
                with open(cache_file, 'w', encoding='utf-8') as f:
                    for entry in valid_cache_entries:
                        f.write(f"{entry}\n")
                        
            except Exception as e:
                print(f"读取缓存文件出错: {str(e)}")
                
        if cached_file:
            return True, cached_file
            
        # 列出所有文件并查找匹配项
        print("\n开始检查服务器上的文件...")
        
        # 遍历所有API实例获取文件
        all_files = []
        for client in gemini_pool.clients:
            try:
                # 获取当前实例的文件列表
                instance_files = list(client.files.list_files())
                if instance_files:
                    print(f"从实例获取到 {len(instance_files)} 个文件")
                    all_files.extend(instance_files)
            except Exception as e:
                print(f"从实例获取文件列表时出错: {str(e)}")
                continue
        
        if not all_files:
            print("所有服务器实例上都没有找到文件")
            return False, None
            
        print(f"所有服务器实例上的文件总数: {len(all_files)}")
        
        # 遍历所有找到的文件
        for file in all_files:
            try:
                print(f"\n检查文件: {file.name}")
                # 遍历所有实例尝试获取文件信息
                remote_file = None
                for client in gemini_pool.clients:
                    try:
                        remote_file = client.files.get(file.name)
                        if remote_file:
                            print(f"在实例中找到文件")
                            break
                    except Exception as e:
                        print(f"尝试从实例获取文件时出错: {str(e)}")
                        continue
                
                if not remote_file:
                    print(f"无法从任何实例获取远程文件: {file.name}")
                    continue
                
                # 获取远程文件状态
                remote_file_state = getattr(remote_file, 'state', None)
                print(f"远程文件状态: {remote_file_state.name if remote_file_state else '未知'}")
                
                # 如果文件状态为ACTIVE，更新缓存
                if remote_file_state and remote_file_state.name == "ACTIVE":
                    try:
                        os.makedirs(os.path.dirname(cache_file), exist_ok=True)
                        with open(cache_file, 'a', encoding='utf-8') as f:
                            f.write(f"{file_path}|{remote_file.uri}|{mime_type}|{current_time}\n")
                    except Exception as e:
                        print(f"更新缓存文件出错: {str(e)}")
                
            except Exception as e:
                print(f"检查远程文件 {file.name} 时出错: {str(e)}")
                continue
                
        print("\n未找到匹配文件")
        return False, None
    except Exception as e:
        print(f"检查文件存在性时出错: {str(e)}")
        import traceback
        print(f"错误详情:\n{traceback.format_exc()}")
        return False, None

def upload_large_file_to_gemini(
    file_path: str,
    file_name: str,
    file_size: int,
    mime_type: str,
    attachment_type: AttachmentType,
    processed_message: Dict[str, Any],
) -> bool:
    """
    通用的大文件上传函数，用于处理图片和视频文件的上传
    
    Args:
        file_path: 本地文件路径
        file_name: 文件名
        file_size: 文件大小（字节）
        mime_type: MIME类型
        attachment_type: 附件类型（GEMINI_IMAGE 或 GEMINI_VIDEO）
        processed_message: 要处理的消息字典
        
    Returns:
        bool: 上传是否成功
    """
    try:
        # 从gemini_pool中获取genai_client实例
        genai_client = gemini_pool.get_client()
        
        # 检查文件大小限制
        if file_size > ATTACHMENT_TYPES[attachment_type]['max_size']:
            error_msg = f"文件大小超过限制: {file_size/(1024*1024*1024):.2f}GB > {ATTACHMENT_TYPES[attachment_type]['max_size']/(1024*1024*1024)}GB"
            print(error_msg)
            send_status({
                'action': 'showUploadError',
                'error': error_msg
            })
            processed_message['parts'].append({
                "text": f"\n注意：该文件大小超过限制，无法处理。"
            })
            return False
            
        # 检查文件格式和MIME类型
        file_ext = os.path.splitext(file_path)[1].lower()
        supported_extensions = ATTACHMENT_TYPES[attachment_type]['extensions']
        supported_mime_types = ATTACHMENT_TYPES[attachment_type]['mime_types']
        
        if file_ext not in supported_extensions:
            error_msg = f"不支持的文件格式: {file_ext}"
            print(error_msg)
            send_status({
                'action': 'showUploadError',
                'error': error_msg
            })
            processed_message['parts'].append({
                "text": f"\n注意：该文件格式不受支持。\n支持的格式：{', '.join(supported_extensions)}"
            })
            return False
            
        if mime_type not in supported_mime_types:
            error_msg = f"不支持的MIME类型: {mime_type}"
            print(error_msg)
            send_status({
                'action': 'showUploadError',
                'error': error_msg
            })
            processed_message['parts'].append({
                "text": f"\n注意：该文件MIME类型不受支持。\n支持的MIME类型：{', '.join(supported_mime_types)}"
            })
            return False
            
        # 检查文件是否已存在
        exists, existing_file = check_file_exists(file_path, mime_type)
        if exists and existing_file:
            print("文件已存在，直接使用")
            send_status({
                'action': 'showUploadSuccess',
                'message': '文件已存在，无需重新上传'
            })
            processed_message['parts'].append(existing_file)
            return True
            
        # 发送上传开始状态
        send_status({
            'action': 'showUploadStart',
            'fileName': file_name,
            'fileSize': file_size
        })
        
        # 上传文件
        print("开始上传文件...")
        uploaded_file = genai_client.files.upload(path=file_path)
        print(f"上传成功！URI: {uploaded_file.uri}")
        
        # 对于视频文件，需要等待处理完成
        if attachment_type == AttachmentType.GEMINI_VIDEO:
            print("等待视频处理完成...")
            send_status({
                'action': 'showUploadStart',
                'fileName': file_name,
                'fileSize': file_size,
                'message': '视频已上传，正在处理中...'
            })
            
            max_wait_time = 300
            wait_interval = 5
            total_waited = 0
            
            while uploaded_file.state.name == "PROCESSING" and total_waited < max_wait_time:
                print('.', end='', flush=True)
                time.sleep(wait_interval)
                total_waited += wait_interval
                uploaded_file = genai_client.files.get(uploaded_file.name)
                
            print("\n处理完成")
            
            if total_waited >= max_wait_time:
                error_msg = "视频处理超时，请稍后重试"
                print(error_msg)
                send_status({
                    'action': 'showUploadError',
                    'error': error_msg
                })
                processed_message['parts'].append({
                    "text": f"\n{error_msg}"
                })
                return False
        
        if uploaded_file.state.name == "ACTIVE":
            print("文件处理成功")
            send_status({
                'action': 'showUploadSuccess'
            })
            
            # 保存文件信息到缓存
            cache_file = os.path.join(os.path.dirname(file_path), '.gemini_files_cache.txt')
            try:
                os.makedirs(os.path.dirname(cache_file), exist_ok=True)
                with open(cache_file, 'a', encoding='utf-8') as f:
                    f.write(f"{file_path}|{uploaded_file.uri}|{mime_type}|{time.time()}\n")
            except Exception as e:
                print(f"保存缓存文件出错: {str(e)}")
            
            processed_message['parts'].append(uploaded_file)
            return True
        else:
            error_msg = f"文件处理失败: {uploaded_file.error if hasattr(uploaded_file, 'error') else '未知错误'}"
            print(error_msg)
            send_status({
                'action': 'showUploadError',
                'error': error_msg
            })
            processed_message['parts'].append({
                "text": f"\n{error_msg}"
            })
            return False
            
    except Exception as e:
        error_msg = f"文件上传处理失败: {str(e)}"
        print(f"\n=== 错误 ===")
        print(error_msg)
        send_status({
            'action': 'showUploadError',
            'error': error_msg
        })
        import traceback
        print(f"错误详情:\n{traceback.format_exc()}")
        processed_message['parts'].append({
            "text": f"\n{error_msg}"
        })
        return False

def process_image_attachment(
    attachment: Dict[str, Any],
    model_type: str,
    processed_message: Dict[str, Any],
    supported_type: str,
    mime_type: str,
    user_id: str
) -> None:
    """
    处理图片类型的附件
    """
    attachment_text = f"[附件[{supported_type}]: {attachment.get('fileName', '未命名文件')}]"
    
    if model_type == 'openai':
        # OpenAI的图片处理
        processed_message['content'].append({
            "type": "text",
            "text": attachment_text
        })
        
        # 获取 base64 数据
        base64_data = None
        if 'base64_id' in attachment:
            try:
                from utils.attachment_handler.image_handler import get_base64_by_id
                print("用户id："+user_id)
                base64_data = get_base64_by_id(attachment['base64_id'], user_id)
            except Exception as e:
                print(f"获取base64数据失败: {e}")
                return
            
        if base64_data:
            processed_message['content'].append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{mime_type};base64,{base64_data}"
                }
            })
        
    elif model_type == 'google':
        # Google的图片处理
        local_path = attachment.get('file_path')
        print("\n=== 图片处理信息 ===")
        print(f"文件名: {attachment.get('fileName', '未命名文件')}")
        print(f"本地路径: {local_path}")
        
        # 1. 如果有本地文件路径，优先获取实际文件大小
        actual_file_size = None
        if local_path and os.path.exists(local_path):
            try:
                actual_file_size = os.path.getsize(local_path)
                print(f"实际文件大小: {actual_file_size} 字节 ({actual_file_size/(1024*1024):.2f}MB)")
                
                # 检查文件是否可读
                with open(local_path, 'rb') as f:
                    first_bytes = f.read(1024)
                    print(f"文件头部字节数: {len(first_bytes)}")
                    
                # 获取文件详细信息
                file_stat = os.stat(local_path)
                print(f"文件创建时间: {time.ctime(file_stat.st_ctime)}")
                print(f"文件最后修改时间: {time.ctime(file_stat.st_mtime)}")
                print(f"文件最后访问时间: {time.ctime(file_stat.st_atime)}")
                print(f"文件inode: {file_stat.st_ino}")
                
            except Exception as e:
                print(f"获取文件信息时出错: {str(e)}")
                import traceback
                print(f"错误详情:\n{traceback.format_exc()}")
        else:
            print(f"本地文件{'不存在' if local_path else '路径为空'}")
        
        # 获取 base64 数据
        base64_data = None
        if 'base64_id' in attachment:
            try:
                from utils.attachment_handler.image_handler import get_base64_by_id
                base64_data = get_base64_by_id(attachment['base64_id'], user_id)
            except Exception as e:
                print(f"获取base64数据失败: {e}")
        
        # 如果没有本地文件，使用base64估算大小
        base64_size = len(base64_data) * 3 / 4 if base64_data else None
        print(f"Base64数据长度: {len(base64_data) if base64_data else 0} 字符")
        print(f"Base64估算大小: {base64_size/(1024*1024):.2f}MB" if base64_size else "无Base64数据")
        
        # 使用实际文件大小或base64估算大小中的较大值
        image_size = max(actual_file_size or 0, base64_size or 0)
        print(f"最终使用的文件大小: {image_size/(1024*1024):.2f}MB")
        
        # 1. 如果文件小于等于20MB，尝试使用PIL处理
        if image_size <= 20 * 1024 * 1024:
            if local_path and os.path.exists(local_path):
                try:
                    print("使用本地文件处理图片")
                    image = PIL.Image.open(local_path)
                    print(f"PIL打开的图片信息: {image.format} {image.mode} {image.size}")
                    processed_message['parts'].append({
                        "text": attachment_text
                    })
                    processed_message['parts'].append(image)
                    print("加入Gemini的图片信息："+str(image))
                    print("Processed Message："+str(processed_message))
                    return
                except Exception as e:
                    print(f"无法打开本地图片文件: {str(e)}")
                    import traceback
                    print(f"错误详情:\n{traceback.format_exc()}")
            
            # 如果本地文件处理失败但有base64数据，使用base64
            if base64_data:
                print("使用base64处理图片")
                processed_message['parts'].append({
                    "text": attachment_text
                })
                processed_message['parts'].append({
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": base64_data
                    }
                })
                return
        
        # 2. 如果文件大于20MB，使用File API
        print(f"图片大小({image_size/(1024*1024):.2f}MB)超过20MB限制，使用File API")
        # if not genai:
        #     print("Gemini API客户端未初始化")
        #     processed_message['parts'].append({
        #         "text": f"\n错误：无法处理大于20MB的图片 - Gemini API未初始化"
        #     })
        #     return
            
        if not local_path or not os.path.exists(local_path):
            error_msg = f"找不到图片文件: {local_path}"
            print(error_msg)
            send_status({
                'action': 'showUploadError',
                'error': error_msg
            })
            processed_message['parts'].append({
                "text": f"\n错误：{error_msg}"
            })
            return
            
        # 使用通用上传函数处理大图片
        file_name = attachment.get('fileName', '未命名文件')
        upload_success = upload_large_file_to_gemini(
            file_path=local_path,
            file_name=file_name,
            file_size=actual_file_size,
            mime_type=mime_type,
            attachment_type=AttachmentType.IMAGE,
            processed_message=processed_message
        )
        
        if upload_success:
            processed_message['parts'].append({
                "text": "\n提示：您可以要求我描述或分析图片的内容"
            })

def process_video_attachment(
    attachment: Dict[str, Any],
    model_type: str,
    processed_message: Dict[str, Any],
    supported_type: str,
    mime_type: str
) -> None:
    """
    处理视频类型的附件
    """
    file_name = attachment.get('fileName', '未命名文件')
    local_path = attachment.get('file_path')
    attachment_text = f"[附件[{supported_type}]: {file_name}]"
    
    print("\n=== 开始处理视频附件 ===")
    print(f"文件名: {file_name}")
    print(f"本地路径: {local_path}")
    print(f"模型类型: {model_type}")
    print(f"支持的类型: {supported_type}")
    print(f"MIME类型: {mime_type}")
    
    if model_type == 'openai':
        print("OpenAI模型不支持视频处理")
        description_text = (
            f"{attachment_text}\n"
            "注意：当前模型不支持视频处理，但您可以告诉用户：\n"
            "1. 切换到支持视频的模型（如Gemini）\n"
            "2. 使用文字描述视频内容\n"
            "3. 提供视频的关键帧或截图（如果支持图片处理）"
        )
        processed_message['content'].append({
            "type": "text",
            "text": description_text
        })
    elif model_type == 'google':
        print("使用Google模型处理视频")
        # print(f"Genai客户端状态: {'已初始化' if genai else '未初始化'}")
        
        # if not genai:
        #     error_msg = "Gemini API客户端未初始化"
        #     print(error_msg)
        #     send_status({
        #         'action': 'showUploadError',
        #         'error': error_msg
        #     })
        #     processed_message['parts'].append({
        #         "text": f"\n错误：{error_msg}"
        #     })
        #     return
            
        if not local_path or not os.path.exists(local_path):
            error_msg = f"找不到视频文件: {local_path}"
            print(error_msg)
            send_status({
                'action': 'showUploadError',
                'error': error_msg
            })
            processed_message['parts'].append({
                "text": f"\n错误：{error_msg}"
            })
            return
            
        # 使用通用上传函数处理视频
        file_size = os.path.getsize(local_path)
        upload_success = upload_large_file_to_gemini(
            file_path=local_path,
            file_name=file_name,
            file_size=file_size,
            mime_type=mime_type,
            attachment_type=AttachmentType.GEMINI_VIDEO,
            processed_message=processed_message
        )
        
        if upload_success:
            processed_message['parts'].append({
                "text": "\n提示：您可以：\n1. 要求我总结视频内容\n2. 使用MM:SS格式引用特定时间点\n3. 请求视频转写和视觉描述"
            })
    else:
        print(f"不支持的模型类型: {model_type}")
    
    print("\n=== 视频处理完成 ===")

def process_binary_attachment(
    attachment: Dict[str, Any],
    model_type: str,
    processed_message: Dict[str, Any],
    supported_type: str
) -> None:
    """
    处理非图片类型的附件
    
    Args:
        attachment: 附件信息字典
        model_type: 模型类型 ('openai' 或 'google')
        processed_message: 要处理的消息字典
        supported_type: 支持的文件类型
    """
    attachment_text = f"[附件[{supported_type}]: {attachment.get('fileName', '未命名文件')}]"
    
    if model_type == 'openai':
        processed_message['content'].append({
            "type": "text",
            "text": attachment_text
        })
    elif model_type == 'google':
        processed_message['parts'].append({
            "text": attachment_text
        })

def process_image_attachment_by_ocr(
    attachment: Dict[str, Any],
    model_type: str,
    processed_message: Dict[str, Any],
    user_id: str = None,
    enable_ocr: bool = True
) -> None:
    """
    使用OCR处理图片附件，提取文本内容并添加到消息中
    
    Args:
        attachment: 附件信息字典
        model_type: 模型类型 ('openai' 或 'google')
        processed_message: 要处理的消息字典
        user_id: 用户ID，用于缓存OCR结果
    """
    from utils.ocr.image_ocr import ImageOCR
    from utils.ocr.ocr_cache import OCRCache
    import os
    
    file_name = attachment.get('fileName', '未命名文件')
    file_path = attachment.get('file_path')
    if not enable_ocr:
        print("OCR功能未开启，跳过OCR处理")
        if model_type == 'openai':
            processed_message['content'].append({
                "type": "text",
                "text": "[图片OCR结果 - "+file_name+"]\nOCR功能未开启，跳过OCR处理"
            })
        else:
            processed_message['parts'].append({
                "text": "[图片OCR结果 - "+file_name+"]\nOCR功能未开启，跳过OCR处理"
            })
        return
    if not file_path or not os.path.exists(file_path):
        error_text = f"[图片OCR失败：找不到文件 {file_name}]"
        if model_type == 'openai':
            processed_message['content'].append({
                "type": "text",
                "text": error_text
            })
        else:
            processed_message['parts'].append({
                "text": error_text
            })
        return
        
    try:
        # 初始化OCR缓存
        cache_dir = os.path.join(os.path.dirname(file_path), '.ocr_cache')
        ocr_cache = OCRCache(cache_dir)
        
        # 尝试从缓存获取OCR结果
        cached_result = None
        if user_id:
            cached_result = ocr_cache.get_ocr_result(user_id, file_path)
            
        if cached_result:
            print("使用缓存的OCR结果")
            extracted_text = cached_result
        else:
            print("执行新的OCR处理")
            # 创建OCR实例并处理图片
            ocr = ImageOCR()
            
            # 设置OCR参数，使用auto模式自动判断内容类型
            params = {
                'rec_mode': 'auto',  # 自动识别模式
                'enable_img_rot': True,  # 启用图片旋转校正
                'inline_formula_wrapper': ['$', '$'],  # 行内公式包装
                'isolated_formula_wrapper': ['$$', '$$']  # 独立公式包装
            }
            
            # 使用通用OCR的auto模式
            print("使用OCR自动识别模式...")
            ocr_result = ocr.image_to_text(file_path, use_common_ocr=True, ocr_params=params)
            extracted_text = ocr.get_text_content(ocr_result)
            
            # 保存OCR结果到缓存
            if user_id and extracted_text:
                ocr_cache.save_ocr_result(user_id, file_path, extracted_text)
        
        # 构建消息文本
        if extracted_text:
            message_text = (
                f"[图片OCR结果 - {file_name}]\n"
                f"提取的文本内容：\n"
                f"{extracted_text}"
            )
        else:
            # 检查原始结果中的错误信息
            error_info = None
            if ocr_result.get('res'):
                if isinstance(ocr_result['res'], dict):
                    error_info = ocr_result['res'].get('error')
                elif isinstance(ocr_result['res'], list):
                    error_info = next((r.get('error') for r in ocr_result['res'] if isinstance(r, dict) and 'error' in r), None)
            
            message_text = (
                f"[图片OCR结果 - {file_name}]\n"
                f"OCR处理结果：{error_info if error_info else '无法提取文本'}"
            )
        
        # 根据模型类型添加到消息中
        if model_type == 'openai':
            processed_message['content'].append({
                "type": "text",
                "text": message_text
            })
        else:
            processed_message['parts'].append({
                "text": message_text
            })
            
    except Exception as e:
        error_text = f"[图片OCR处理失败：{str(e)}]"
        if model_type == 'openai':
            processed_message['content'].append({
                "type": "text",
                "text": error_text
            })
        else:
            processed_message['parts'].append({
                "text": error_text
            })