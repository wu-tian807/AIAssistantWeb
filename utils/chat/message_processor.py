import os
import base64
import PIL.Image
from typing import Dict, Any

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
        image_size = len(attachment['base64']) * 3 / 4  # Base64解码后的大致大小
        
        if image_size <= 20 * 1024 * 1024:  # 20MB以下
            local_path = attachment.get('file_path')
            
            if local_path and os.path.exists(local_path):
                try:
                    image = PIL.Image.open(local_path)
                    processed_message['parts'].append({
                        "text": attachment_text
                    })
                    processed_message['parts'].append(image)
                    return
                except Exception as e:
                    print(f"无法打开本地图片文件: {str(e)}")
            
            # 如果本地文件处理失败或不存在，使用base64
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
            if genai:
                file_data = base64.b64decode(attachment['base64'])
                file_uri = genai.upload_file(file_data)
                processed_message['parts'].append({
                    "text": attachment_text
                })
                processed_message['parts'].append({
                    "file_data": {
                        "mime_type": mime_type,
                        "file_uri": file_uri
                    }
                })

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