import tiktoken
from typing import List, Dict, Tuple
import json
import requests
import tempfile
import os
from PIL import Image
import base64
import io
import math
import cv2
from config import API_KEYS, API_BASE_URLS

class TokenCounter:
    def __init__(self):
        """初始化token计数器，使用cl100k_base编码器"""
        self.encoder = tiktoken.get_encoding("cl100k_base")
        
    def count_tokens_by_model(self, text: str, model_id: str) -> int:
        """根据不同模型使用相应的token计算方法"""
        if model_id.startswith('grok'):
            return self._count_grok_tokens(text, model_id)
        elif model_id.startswith('deepseek'):
            return self._count_deepseek_tokens(text)
        else:
            return self.estimate_tokens(text)
            
    def _count_grok_tokens(self, text: str, model_id: str) -> int:
        """使用Grok的tokenize-text API计算token数"""
        try:
            headers = {
                "Authorization": f"Bearer {API_KEYS['xai'][0]}",
                "Content-Type": "application/json"
            }
            data = {"text": text, "model": model_id}
            response = requests.post(
                f"{API_BASE_URLS['xai']}/tokenize-text",
                headers=headers,
                json=data
            )
            return len(response.json()["token_ids"]) if response.ok else self.estimate_tokens(text)
        except Exception as e:
            print(f"Grok token计算失败: {str(e)}")
            return self.estimate_tokens(text)
            
    def _count_deepseek_tokens(self, text: str) -> int:
        """使用tiktoken计算DeepSeek模型的token数"""
        return self.estimate_tokens(text)

    def estimate_tokens(self, text: str) -> int:
        """使用tiktoken计算文本token数量"""
        return len(self.encoder.encode(text)) if text else 0

    def estimate_image_tokens(self, image_path: str = None, base64_data: str = None) -> int:
        """估算图片的token数（基于16x16分块）"""
        try:
            if base64_data:
                img = Image.open(io.BytesIO(base64.b64decode(base64_data)))
            elif image_path:
                img = Image.open(image_path)
            else:
                return 0
            
            w, h = img.size
            num_patches = math.ceil(w/16) * math.ceil(h/16)
            return int(num_patches * 2 * 1.5)  # 每个分块2token，1.5倍余量
        except Exception as e:
            print(f"图片处理错误: {str(e)}")
            return 100  # 返回一个保守的默认值，避免完全忽略图片

    def estimate_video_tokens(self, video_path: str) -> int:
        """估算视频token数（1fps采样+音频估算）"""
        try:
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                return 0
            
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = max(cap.get(cv2.CAP_PROP_FPS), 1)
            duration = frame_count / fps
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()
            
            num_frames = int(duration)
            patches_per_frame = math.ceil(w/16) * math.ceil(h/16)
            video_tokens = num_frames * patches_per_frame * 2
            audio_tokens = int(duration * 20)
            
            return int((video_tokens + audio_tokens) * 1.5)
        except Exception as e:
            print(f"视频处理错误: {str(e)}")
            return 0

    def estimate_message_tokens(self, messages: List[Dict], model_id: str = None) -> Tuple[int, int]:
        """
        支持多模态内容的token估算
        返回: (输入token数, 输出token数)
        """
        input_tokens = 0
        output_tokens = 0
        
        for message in messages:
            role = message.get('role', '')
            
            if 'content' in message and isinstance(message['content'], list):
                for item in message['content']:
                    tokens = self._process_content_item(item, model_id)
                    if role == 'assistant':
                        output_tokens += tokens
                    else:
                        input_tokens += tokens
            
            elif 'parts' in message:
                for part in message['parts']:
                    tokens = self._process_part(part, model_id)
                    if role == 'assistant':
                        output_tokens += tokens
                    else:
                        input_tokens += tokens
            
            else:
                text = str(message.get('content', ''))
                tokens = self.count_tokens_by_model(text, model_id)
                if role == 'assistant':
                    output_tokens += tokens
                else:
                    input_tokens += tokens
        
        return input_tokens, output_tokens

    def _process_content_item(self, item: Dict, model_id: str) -> int:
        """处理OpenAI格式的内容项"""
        if item.get('type') == 'text':
            return self.count_tokens_by_model(item.get('text', ''), model_id)
        elif 'image_url' in item:
            url = item['image_url'].get('url', '')
            if url.startswith('data:image/'):
                base64_data = url.split(',', 1)[1]
                print(f"处理图片，base64数据长度: {len(base64_data)}")
                return self.estimate_image_tokens(base64_data=base64_data)
            else:
                print(f"图片URL格式错误: {url}")
        else:
            print(f"未知内容项类型: {item}")
        return 0

    def _process_part(self, part, model_id: str) -> int:
        """处理Google格式的内容部分"""
        if isinstance(part, dict) and 'inline_data' in part:
            mime_type = part['inline_data'].get('mime_type', '')
            data = part['inline_data'].get('data', '')
            
            if mime_type.startswith('image/'):
                return self.estimate_image_tokens(base64_data=data)
            elif mime_type.startswith('video/'):
                try:
                    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=True) as f:
                        f.write(base64.b64decode(data))
                        f.flush()
                        return self.estimate_video_tokens(f.name)
                except Exception as e:
                    print(f"视频解码失败: {str(e)}")
                    return 0
        return self.count_tokens_by_model(str(part), model_id)

    def estimate_completion_tokens(self, text: str, model_id: str = None) -> int:
        """计算生成文本的token数量"""
        return self.count_tokens_by_model(text, model_id) if model_id else self.estimate_tokens(text)