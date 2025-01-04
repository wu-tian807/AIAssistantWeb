import os
import base64
import time
import PIL.Image
from typing import Dict, Any
from utils.files.file_config import ATTACHMENT_TYPES, AttachmentType

def check_file_exists(file_path: str, genai, mime_type: str = None) -> tuple:
    """
    检查文件是否已经存在于Gemini服务器
    
    Args:
        file_path: 本地文件路径
        genai: Google AI 客户端实例
        mime_type: 文件的MIME类型（可选）
        
    Returns:
        tuple: (是否存在, 文件对象或None)
    """
    if not genai:
        return False, None
        
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
        if os.path.exists(cache_file):
            print("\n检查本地缓存...")
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        try:
                            cached_path, cached_uri, cached_mime = line.strip().split('|')
                            if (os.path.normpath(cached_path) == os.path.normpath(file_path) and 
                                (not mime_type or cached_mime == mime_type)):
                                print(f"在缓存中找到匹配: {cached_uri}")
                                remote_file = genai.get_file(cached_uri.split('/')[-1])
                                if remote_file and remote_file.state.name == "ACTIVE":
                                    print("远程文件状态正常")
                                    return True, remote_file
                        except ValueError:
                            continue
            except Exception as e:
                print(f"读取缓存文件出错: {str(e)}")
            
        # 列出所有文件并查找匹配项
        print("\n开始检查服务器上的文件...")
        
        # 将生成器转换为列表以便重用
        files = list(genai.list_files())
        if not files:
            print("服务器上没有文件")
            return False, None
            
        print(f"服务器上的文件数量: {len(files)}")
        
        for file in files:
            try:
                print(f"\n检查文件: {file.name}")
                # 获取远程文件信息
                remote_file = genai.get_file(file.name)
                if not remote_file:
                    print(f"无法获取远程文件: {file.name}")
                    continue
                
                # 获取远程文件状态
                remote_file_state = getattr(remote_file, 'state', None)
                print(f"远程文件状态: {remote_file_state.name if remote_file_state else '未知'}")
                
                # 如果文件状态为ACTIVE，更新缓存
                if remote_file_state and remote_file_state.name == "ACTIVE":
                    try:
                        os.makedirs(os.path.dirname(cache_file), exist_ok=True)
                        with open(cache_file, 'a', encoding='utf-8') as f:
                            f.write(f"{file_path}|{remote_file.uri}|{mime_type}\n")
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

def process_image_attachment(
    attachment: Dict[str, Any],
    model_type: str,
    processed_message: Dict[str, Any],
    supported_type: str,
    mime_type: str,
    genai=None
) -> None:
    """
    处理图片类型的附件
    
    Args:
        attachment: 附件信息字典
        model_type: 模型类型 ('openai' 或 'google')
        processed_message: 要处理的消息字典
        supported_type: 支持的文件类型
        mime_type: MIME类型
        genai: Google AI 客户端实例（可选）
    """
    if not attachment.get('base64'):
        return
        
    attachment_text = f"[附件[{supported_type}]: {attachment.get('fileName', '未命名文件')}]"
    
    if model_type == 'openai':
        # OpenAI的图片处理
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
        # Google的图片处理
        local_path = attachment.get('file_path')
        image_size = len(attachment['base64']) * 3 / 4  # Base64解码后的大致大小
        
        # 1. 如果有本地文件路径且文件存在，直接使用PIL处理
        if local_path and os.path.exists(local_path) and image_size <= 20 * 1024 * 1024:
            try:
                print("使用本地文件处理图片")
                image = PIL.Image.open(local_path)
                processed_message['parts'].append({
                    "text": attachment_text
                })
                processed_message['parts'].append(image)
                return
            except Exception as e:
                print(f"无法打开本地图片文件: {str(e)}")
                # 如果本地文件处理失败，继续尝试其他方法
        
        # 2. 如果文件小于等于20MB，使用base64
        if image_size <= 20 * 1024 * 1024:
            print("使用base64处理图片")
            processed_message['parts'].append({
                "text": attachment_text
            })
            processed_message['parts'].append({
                "inline_data": {
                    "mime_type": mime_type,
                    "data": attachment['base64']
                }
            })
            return
            
        # 3. 如果文件大于20MB，使用File API
        print("图片大于20MB，使用File API")
        if not genai:
            print("Gemini API客户端未初始化")
            processed_message['parts'].append({
                "text": f"\n错误：无法处理大于20MB的图片 - Gemini API未初始化"
            })
            return
            
        try:
            # 先检查文件是否已存在于Gemini服务器
            if local_path and os.path.exists(local_path):
                exists, existing_file = check_file_exists(local_path, genai, mime_type)
                if exists and existing_file:
                    print("文件已存在于Gemini服务器，直接使用")
                    processed_message['parts'].append({
                        "text": attachment_text
                    })
                    processed_message['parts'].append(existing_file)
                    return
            
            # 文件不存在，开始上传
            print("开始上传大文件...")
            if local_path and os.path.exists(local_path):
                # 优先使用本地文件路径上传
                file = genai.upload_file(path=local_path)
            else:
                # 如果没有本地文件，使用base64数据
                file_data = base64.b64decode(attachment['base64'])
                file = genai.upload_file(file_data)
                
            print(f"上传成功！URI: {file.uri}")
            
            # 保存文件信息到缓存
            if local_path:
                cache_file = os.path.join(os.path.dirname(local_path), '.gemini_files_cache.txt')
                try:
                    os.makedirs(os.path.dirname(cache_file), exist_ok=True)
                    with open(cache_file, 'a', encoding='utf-8') as f:
                        f.write(f"{local_path}|{file.uri}|{mime_type}\n")
                except Exception as e:
                    print(f"保存缓存文件出错: {str(e)}")
            
            processed_message['parts'].append({
                "text": attachment_text
            })
            processed_message['parts'].append(file)
            
        except Exception as e:
            print(f"文件上传失败: {str(e)}")
            processed_message['parts'].append({
                "text": f"\n错误：图片上传失败 - {str(e)}"
            })

def process_video_attachment(
    attachment: Dict[str, Any],
    model_type: str,
    processed_message: Dict[str, Any],
    supported_type: str,
    mime_type: str,
    genai=None
) -> None:
    """
    处理视频类型的附件
    """
    file_name = attachment.get('fileName', '未命名文件')
    attachment_text = f"[附件[{supported_type}]: {file_name}]"
    
    print("\n=== 开始处理视频附件 ===")
    print(f"文件名: {file_name}")
    print(f"模型类型: {model_type}")
    print(f"支持的类型: {supported_type}")
    print(f"MIME类型: {mime_type}")
    
    if model_type == 'openai':
        print("OpenAI模型不支持视频处理")
        # 添加视频文件名和说明
        description_text = (
            f"{attachment_text}\n"
            "注意：当前模型不支持视频处理，但您可以告诉用户：\n"
            "1. 切换到支持视频的模型（如Gemini）\n"
            "2. 使用文字描述视频内容\n"
            "3. 提供视频的关键帧或截图（如果你支持图片处理）"
        )
        processed_message['content'].append({
            "type": "text",
            "text": description_text
        })
    elif model_type == 'google':
        print("使用Google模型处理视频")
        print(f"Genai客户端状态: {'已初始化' if genai else '未初始化'}")
        
        if not genai:
            error_msg = "Gemini API客户端未初始化"
            print(error_msg)
            processed_message['parts'].append({
                "text": f"\n错误：{error_msg}"
            })
            return
            
        try:
            print("\nGenai API配置信息:")
            print(f"API版本: {genai.__version__}")
            print(f"已配置API密钥: {'是' if genai.get_default_api_key() else '否'}")
        except Exception as e:
            print(f"获取Genai配置信息失败: {str(e)}")
        
        # 添加视频描述文本
        description_text = (
            f"{attachment_text}\n"
            "如果用户没有任何描述，请帮用户：\n"
            "1. 分析视频的主要内容\n"
            "2. 描述视频中的关键场景\n"
            "3. 总结视频传达的主要信息\n"
        )
        processed_message['parts'].append({
            "text": description_text
        })
        
        # 检查是否有本地文件路径
        local_path = attachment.get('file_path')
        print(f"\n本地文件路径: {local_path}")
        print(f"文件是否存在: {'是' if os.path.exists(local_path) else '否'}")
        
        if not local_path or not os.path.exists(local_path):
            error_msg = f"找不到视频文件: {local_path}"
            print(error_msg)
            processed_message['parts'].append({
                "text": f"\n错误：{error_msg}"
            })
            return
            
        # 检查文件大小
        file_size = os.path.getsize(local_path)
        print(f"\n文件大小: {file_size} 字节 ({file_size/(1024*1024):.2f}MB)")
        print(f"最大允许大小: {ATTACHMENT_TYPES[AttachmentType.GEMINI_VIDEO]['max_size']} 字节")
        
        if file_size > ATTACHMENT_TYPES[AttachmentType.GEMINI_VIDEO]['max_size']:
            error_msg = f"文件大小超过Gemini限制: {file_size/(1024*1024*1024):.2f}GB > 2GB"
            print(error_msg)
            processed_message['parts'].append({
                "text": f"\n注意：该视频文件大小超过Gemini的2GB限制，无法处理。"
            })
            return
            
        # 检查文件格式和MIME类型
        file_ext = os.path.splitext(local_path)[1].lower()
        supported_extensions = ATTACHMENT_TYPES[AttachmentType.GEMINI_VIDEO]['extensions']
        supported_mime_types = ATTACHMENT_TYPES[AttachmentType.GEMINI_VIDEO]['mime_types']
        
        print(f"\n文件格式检查:")
        print(f"文件扩展名: {file_ext}")
        print(f"支持的扩展名: {supported_extensions}")
        print(f"扩展名是否支持: {'是' if file_ext in supported_extensions else '否'}")
        print(f"\nMIME类型检查:")
        print(f"当前MIME类型: {mime_type}")
        print(f"支持的MIME类型: {supported_mime_types}")
        print(f"MIME类型是否支持: {'是' if mime_type in supported_mime_types else '否'}")
        
        if file_ext not in supported_extensions:
            error_msg = f"不支持的视频格式: {file_ext}"
            print(error_msg)
            processed_message['parts'].append({
                "text": f"\n注意：该视频格式不受Gemini支持。\n支持的格式：{', '.join(supported_extensions)}"
            })
            return
            
        if mime_type not in supported_mime_types:
            error_msg = f"不支持的MIME类型: {mime_type}"
            print(error_msg)
            processed_message['parts'].append({
                "text": f"\n注意：该视频MIME类型不受Gemini支持。\n支持的MIME类型：{', '.join(supported_mime_types)}"
            })
            return
            
        # 使用File API上传视频
        try:
            print("\n=== 开始处理视频 ===")
            print(f"检查文件: {local_path}")
            
            # 先检查文件是否已存在
            exists, existing_file = check_file_exists(local_path, genai, mime_type)
            if exists and existing_file:
                print("文件已存在，直接使用")
                processed_message['parts'].append(existing_file)
                processed_message['parts'].append({
                    "text": "\n提示：您可以：\n1. 要求我总结视频内容\n2. 使用MM:SS格式引用特定时间点\n3. 请求视频转写和视觉描述"
                })
                return
                
            print("文件不存在，开始上传")
            print("调用genai.upload_file...")
            video_file = genai.upload_file(path=local_path)
            print(f"上传成功！URI: {video_file.uri}")
            
            # 保存文件信息到缓存
            cache_file = os.path.join(os.path.dirname(local_path), '.gemini_files_cache.txt')
            try:
                os.makedirs(os.path.dirname(cache_file), exist_ok=True)
                with open(cache_file, 'a', encoding='utf-8') as f:
                    f.write(f"{local_path}|{video_file.uri}|{mime_type}\n")
            except Exception as e:
                print(f"保存缓存文件出错: {str(e)}")
            
            # 等待视频处理完成
            print("\n=== 等待视频处理 ===")
            processing_start_time = time.time()
            while video_file.state.name == "PROCESSING":
                elapsed_time = time.time() - processing_start_time
                print(f"\r处理中... 已等待: {int(elapsed_time)}秒", end='', flush=True)
                time.sleep(10)  # 每10秒检查一次状态
                video_file = genai.get_file(video_file.name)
            print("\n处理完成！")
            
            if video_file.state.name == "ACTIVE":
                print("视频处理成功，添加到消息中")
                # 将视频添加到消息中
                processed_message['parts'].append(video_file)
                processed_message['parts'].append({
                    "text": "\n提示：您可以：\n1. 要求我总结视频内容\n2. 使用MM:SS格式引用特定时间点\n3. 请求视频转写和视觉描述"
                })
            elif video_file.state.name == "FAILED":
                error_msg = f"视频处理失败: {video_file.error if hasattr(video_file, 'error') else '未知错误'}"
                print(error_msg)
                processed_message['parts'].append({
                    "text": f"\n{error_msg}"
                })
            else:
                error_msg = f"视频处理状态异常: {video_file.state.name}"
                print(error_msg)
                processed_message['parts'].append({
                    "text": f"\n{error_msg}"
                })
                
        except Exception as e:
            error_msg = f"视频上传处理失败: {str(e)}"
            print(f"\n=== 错误 ===")
            print(error_msg)
            import traceback
            print(f"错误详情:\n{traceback.format_exc()}")
            processed_message['parts'].append({
                "text": f"\n{error_msg}"
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