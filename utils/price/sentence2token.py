import jieba
import nltk
from tinysegmenter import TinySegmenter
import re
import unicodedata

# 下载必要的NLTK数据
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

class TokenCounter:
    def __init__(self):
        self.segmenter = TinySegmenter()
        
    def detect_language(self, text):
        """
        简单的语言检测函数
        基于字符集特征检测语言
        """
        if not text:
            return 'en'
            
        # 计算不同字符类型的比例
        total_chars = len(text)
        if total_chars == 0:
            return 'en'
            
        # 统计各种字符的数量
        chinese_chars = sum(1 for char in text if '\u4e00' <= char <= '\u9fff')
        japanese_chars = sum(1 for char in text if ('\u3040' <= char <= '\u309f') or ('\u30a0' <= char <= '\u30ff'))
        english_chars = sum(1 for char in text if unicodedata.category(char).startswith('L') and ord(char) < 128)
        
        # 计算比例
        chinese_ratio = chinese_chars / total_chars
        japanese_ratio = japanese_chars / total_chars
        english_ratio = english_chars / total_chars
        
        # 根据比例判断语言
        if chinese_ratio > 0.2:  # 如果超过20%是中文字符
            return 'zh'
        elif japanese_ratio > 0.2:  # 如果超过20%是日文字符
            return 'ja'
        elif english_ratio > 0.2:  # 如果超过20%是英文字符
            return 'en'
        else:
            return 'en'  # 默认返回英文
        
    def count_tokens(self, text):
        """
        计算文本的大致token数量
        这是一个粗略的估计，实际token数可能与模型的分词方式有所不同
        """
        if not text:
            return 0
            
        try:
            # 检测语言
            lang_code = self.detect_language(text)
            
            # 移除多余的空白字符
            text = re.sub(r'\s+', ' ', text.strip())
            
            # 根据不同语言使用不同的分词方法
            if lang_code == 'zh':  # 中文
                tokens = list(jieba.cut(text))
            elif lang_code == 'ja':  # 日语
                tokens = self.segmenter.tokenize(text)
            else:  # 英文和其他语言
                tokens = nltk.word_tokenize(text)
                
            # 特殊字符和标点符号的处理
            processed_tokens = []
            for token in tokens:
                # 处理数字
                if re.match(r'^\d+$', token):
                    # 每4个数字算作一个token
                    processed_tokens.extend(['0'] * (len(token) // 4 + 1))
                # 处理特殊字符和标点
                elif re.match(r'^[^\w\s]$', token):
                    processed_tokens.append(token)
                # 处理普通token
                else:
                    processed_tokens.append(token)
            
            # 返回token数量
            return len(processed_tokens)
            
        except Exception as e:
            print(f"Token计算错误: {str(e)}")
            # 如果分词失败，使用简单的空格分割作为后备方案
            words = text.split()
            return len(words)
    
    def estimate_tokens(self, messages):
        """
        估算对话消息的token数量
        返回输入和输出的token数量
        """
        input_tokens = 0
        output_tokens = 0
        
        for message in messages:
            content = message.get('content', '')
            
            # 处理不同消息格式
            if isinstance(content, list):
                # 处理OpenAI格式的消息
                for item in content:
                    if isinstance(item, dict):
                        if item.get('type') == 'text':
                            text = item.get('text', '')
                            tokens = self.count_tokens(text)
                        else:
                            # 非文本内容（如图片）按固定token计算
                            tokens = 50  # 假设每个非文本内容占50个token
                    else:
                        tokens = self.count_tokens(str(item))
                        
                    if message.get('role') == 'assistant':
                        output_tokens += tokens
                    else:
                        input_tokens += tokens
                        
            elif isinstance(content, str):
                tokens = self.count_tokens(content)
                if message.get('role') == 'assistant':
                    output_tokens += tokens
                else:
                    input_tokens += tokens
            
            # 处理parts字段（Google模型格式）
            if 'parts' in message:
                for part in message['parts']:
                    if isinstance(part, dict):
                        if 'text' in part:
                            tokens = self.count_tokens(part['text'])
                        else:
                            # 非文本内容按固定token计算
                            tokens = 50
                    else:
                        tokens = self.count_tokens(str(part))
                        
                    if message.get('role') == 'assistant':
                        output_tokens += tokens
                    else:
                        input_tokens += tokens
        
        return input_tokens, output_tokens
