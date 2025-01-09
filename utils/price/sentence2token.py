import jieba
import nltk
from tinysegmenter import TinySegmenter
import re
import unicodedata

# 下载必要的NLTK数据
try:
    nltk.data.find('tokenizers/punkt')
    nltk.data.find('tokenizers/punkt_tab')
except LookupError:
    nltk.download('punkt')
    nltk.download('punkt_tab')

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
                tokens = word_tokenize_safe(text)
                
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
    
    def calculate_image_tokens(self, image_data):
        """
        计算图片的token数量
        根据OpenAI的规则和程序的压缩策略：
        1. 小图片token消耗：
           - 低于1MB（或压缩后）: 65 tokens
           - 1MB-4MB: 85 tokens
        2. 大图片token消耗：
           - 4MB以上基础值: 129 tokens
           - 每额外4MB增加129个tokens
        """
        if not image_data:
            return 65  # 默认按最小值计算
            
        try:
            # 从base64数据估算图片大小
            if isinstance(image_data, str) and image_data.startswith('data:'):
                # 移除MIME类型前缀
                base64_data = image_data.split(',')[1]
                # 估算原始大小（字节）
                image_size = len(base64_data) * 3 / 4
                size_mb = image_size / (1024 * 1024)
                
                # 根据大小分级计算tokens
                if size_mb <= 1:
                    tokens = 65  # 1MB以下（包括压缩后的图片）
                elif size_mb <= 4:
                    tokens = 85  # 1MB-4MB
                else:
                    # 4MB以上：基础129 tokens + 每4MB额外129 tokens
                    additional_chunks = int((size_mb - 4) / 4)
                    tokens = 129 + (additional_chunks * 129)
                
                print(f"图片大小: {size_mb:.2f}MB")
                if size_mb > 4:
                    print(f"额外块数: {additional_chunks}")
                print(f"总token数: {tokens}")
                
                return tokens
            else:
                return 65  # 默认按最小值计算
                
        except Exception as e:
            print(f"计算图片token出错: {str(e)}")
            return 65  # 出错时按最小值计算

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
                        elif item.get('type') == 'image_url':
                            # 处理图片token
                            image_url = item.get('image_url', {}).get('url', '')
                            tokens = self.calculate_image_tokens(image_url)
                        else:
                            # 其他类型的内容
                            tokens = 50
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

# 添加错误处理，如果资源仍然无法加载，使用备用方案
def word_tokenize_safe(text):
    try:
        return nltk.word_tokenize(text)
    except LookupError:
        # 备用方案：简单的空格分词
        return text.split()
