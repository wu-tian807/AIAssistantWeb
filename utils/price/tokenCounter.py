import tiktoken
from typing import List, Dict, Tuple
import json
import requests
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
            # 默认使用tiktoken
            return self.estimate_tokens(text)
            
    def _count_grok_tokens(self, text: str, model_id: str) -> int:
        """使用Grok的tokenize-text API计算token数"""
        try:
            headers = {
                "Authorization": f"Bearer {API_KEYS['xai'][0]}",
                "Content-Type": "application/json"
            }
            data = {
                "text": text,
                "model": model_id
            }
            response = requests.post(
                f"{API_BASE_URLS['xai']}/tokenize-text",
                headers=headers,
                json=data
            )
            if response.status_code == 200:
                return len(response.json()["token_ids"])
            else:
                # 如果API调用失败，回退到tiktoken
                print(f"Grok token计算API调用失败: {response.text}")
                return self.estimate_tokens(text)
        except Exception as e:
            print(f"Grok token计算出错: {str(e)}")
            return self.estimate_tokens(text)
            
    def _count_deepseek_tokens(self, text: str) -> int:
        """使用tiktoken计算DeepSeek模型的token数"""
        return self.estimate_tokens(text)

    def estimate_tokens(self, text: str) -> int:
        """使用tiktoken计算单个文本的token数量"""
        if not text:
            return 0
        return len(self.encoder.encode(text))

    def estimate_message_tokens(self, messages: List[Dict], model_id: str = None) -> Tuple[int, int]:
        """
        计算消息列表的token数量
        支持OpenAI格式和Google格式的消息
        返回: (输入token数, 输出token数)
        """
        input_tokens = 0
        output_tokens = 0
        
        for message in messages:
            content = message.get('content', '')
            role = message.get('role', '')
            
            # 处理OpenAI格式的消息（content可能是列表）
            if isinstance(content, list):
                text_content = ''
                for item in content:
                    if isinstance(item, dict):
                        if item.get('type') == 'text':
                            text_content += item.get('text', '')
                        elif 'text' in item:
                            text_content += item['text']
                content = text_content
            
            # 处理Google格式的消息（使用parts字段）
            if 'parts' in message:
                parts_content = []
                for part in message['parts']:
                    if isinstance(part, dict) and 'text' in part:
                        parts_content.append(part['text'])
                    elif isinstance(part, str):
                        parts_content.append(part)
                content += ' '.join(parts_content)
            
            # 根据模型选择合适的token计算方法
            tokens = self.count_tokens_by_model(str(content), model_id) if model_id else self.estimate_tokens(str(content))
            
            # 根据角色分配token数
            if role == 'assistant':
                output_tokens += tokens
            else:
                input_tokens += tokens
        
        return input_tokens, output_tokens

    def estimate_completion_tokens(self, text: str, model_id: str = None) -> int:
        """计算生成文本的token数量"""
        if model_id:
            return self.count_tokens_by_model(text, model_id)
        return self.estimate_tokens(text)
