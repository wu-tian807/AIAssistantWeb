import jieba
import nltk
from tinysegmenter import TinySegmenter
import re
import unicodedata
from typing import List, Tuple, Dict
import spacy  # 用于更好的语言检测和分词
import logging
from langdetect import detect, detect_langs  # 替换pycld2
from pythainlp import word_tokenize as thai_tokenize  # 泰语分词
from konlpy.tag import Kkma  # 替换Mecab为Kkma
import jieba.posseg as pseg  # 添加这行导入
import os

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 下载必要的NLTK数据
try:
    nltk.data.find('tokenizers/punkt')
    nltk.data.find('tokenizers/punkt_tab')
except LookupError:
    nltk.download('punkt')
    nltk.download('punkt_tab')
    nltk.download('averaged_perceptron_tagger_eng')

class TokenCounter:
    def _check_java_env(self):
        """检查Java环境配置"""
        import os
        import subprocess
        
        try:
            # 检查JAVA_HOME环境变量
            java_home = os.environ.get('JAVA_HOME')
            if not java_home:
                logger.warning("JAVA_HOME环境变量未设置")
                return False
                
            # 检查jvm.dll文件
            jvm_path = os.path.join(java_home, 'bin', 'server', 'jvm.dll')
            if not os.path.exists(jvm_path):
                alt_jvm_path = os.path.join(java_home, 'jre', 'bin', 'server', 'jvm.dll')
                if not os.path.exists(alt_jvm_path):
                    logger.warning(f"未找到jvm.dll文件: {jvm_path} 或 {alt_jvm_path}")
                    return False
                    
            # 检查java版本
            try:
                result = subprocess.run(['java', '-version'], capture_output=True, text=True)
                if result.returncode == 0:
                    logger.info(f"Java版本信息: {result.stderr.strip()}")  # java -version输出到stderr
                    return True
            except Exception as e:
                logger.warning(f"检查Java版本失败: {str(e)}")
                return False
                
        except Exception as e:
            logger.error(f"检查Java环境时出错: {str(e)}")
            return False
            
    def __init__(self):
        try:
            # 获取词典目录路径
            self.base_dir = os.path.dirname(os.path.abspath(__file__))
            self.dict_dir = os.path.join(self.base_dir, 'dicts')
            
            # 基础自定义词典（作为默认词典）
            self.custom_words = [
                # AI/技术相关
                ('人工智能', 'n', 2000), ('机器学习', 'n', 2000), ('深度学习', 'n', 2000),
                ('自然语言处理', 'n', 2000), ('计算机视觉', 'n', 2000),
                ('神经网络', 'n', 2000), ('大语言模型', 'n', 2000), ('强化学习', 'n', 2000),
                ('图像识别', 'n', 2000), ('语音识别', 'n', 2000), ('机器翻译', 'n', 2000),
                
                # 机构/组织
                ('北京大学', 'nt', 3000), ('清华大学', 'nt', 3000), ('中国科学院', 'nt', 3000),
                ('腾讯公司', 'nt', 3000), ('阿里巴巴', 'nt', 3000), ('百度公司', 'nt', 3000),
                ('计算机科学研究所', 'nt', 3000),
                
                # 专业领域
                ('计算机科学', 'n', 2000), ('软件工程', 'n', 2000), ('数据科学', 'n', 2000),
                ('信息技术', 'n', 2000), ('云计算', 'n', 2000), ('大数据', 'n', 2000),
                ('实验室', 'n', 1000),
                
                # 技术产品
                ('ChatGPT', 'nz', 3000), ('GPT-4', 'nz', 3000), ('BERT', 'nz', 3000),
                ('Transformer', 'nz', 3000), ('PyTorch', 'nz', 3000), ('TensorFlow', 'nz', 3000)
            ]
            
            # 从外部词典文件加载
            self._load_domain_words()
            
            self.segmenter = TinySegmenter()
            
            # 检查Java环境
            if self._check_java_env():
                logger.info("Java环境检查通过")
            else:
                logger.warning("Java环境检查失败，韩语分词功能可能不可用")
                
            self._initialize_nlp()
            self._initialize_jieba()
            
        except Exception as e:
            logger.error(f"TokenCounter初始化失败: {str(e)}")
            raise
        
    def _load_domain_words(self):
        """从外部词典文件加载领域词汇"""
        try:
            # 获取所有合并后的词典文件
            merged_files = [f for f in os.listdir(self.dict_dir) if f.startswith('merged_')]
            total_words = 0
            
            for dict_file in merged_files:
                words_count = 0
                dict_path = os.path.join(self.dict_dir, dict_file)
                
                with open(dict_path, 'r', encoding='utf-8') as f:
                    for line_num, line in enumerate(f, 1):
                        try:
                            line = line.strip()
                            if not line or line.startswith('#'):
                                continue
                                
                            # 尝试解析行内容
                            parts = line.split('\t')
                            
                            # 如果只有一个词，添加默认词性和频率
                            if len(parts) == 1:
                                word = parts[0]
                                if re.match(r'^[\u4e00-\u9fff]+$', word):  # 中文词
                                    pos = 'n'
                                else:
                                    pos = 'x'  # 外文词
                                freq = 1000
                            elif len(parts) == 2:
                                word, pos = parts
                                freq = 1000
                            elif len(parts) >= 3:
                                word, pos, freq = parts[0], parts[1], parts[2]
                                try:
                                    freq = int(freq)
                                except ValueError:
                                    freq = 1000
                            else:
                                continue
                            
                            # 清理和验证
                            word = word.strip()
                            pos = pos.strip()
                            if not word:  # 跳过空词
                                continue
                                
                            self.custom_words.append((word, pos, freq))
                            words_count += 1
                            
                        except Exception as e:
                            logger.warning(f"解析词典 {dict_file} 第 {line_num} 行时出错: {str(e)}")
                            continue
                            
                logger.info(f"从 {dict_file} 加载了 {words_count} 个词条")
                total_words += words_count
                
            # 如果存在百度词典，也加载它
            baidu_path = os.path.join(self.dict_dir, 'baidu_merged_zh.txt')
            if os.path.exists(baidu_path):
                words_count = 0
                with open(baidu_path, 'r', encoding='utf-8') as f:
                    for line_num, line in enumerate(f, 1):
                        try:
                            line = line.strip()
                            if not line or line.startswith('#'):
                                continue
                                
                            parts = line.split('\t')
                            if len(parts) >= 1:
                                word = parts[0].strip()
                                pos = parts[1].strip() if len(parts) > 1 else 'n'
                                freq = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 2000
                                
                                if word:
                                    self.custom_words.append((word, pos, freq))
                                    words_count += 1
                                    
                        except Exception as e:
                            logger.warning(f"解析百度词典第 {line_num} 行时出错: {str(e)}")
                            continue
                            
                logger.info(f"从百度词典加载了 {words_count} 个词条")
                total_words += words_count
                
            # 去重
            self.custom_words = list(set(self.custom_words))
            logger.info(f"总共加载了 {len(self.custom_words)} 个唯一词条")
            
        except Exception as e:
            logger.error(f"加载词典文件失败: {str(e)}")
            # 确保即使加载失败也有基础词典
            if not self.custom_words:
                self.custom_words = [
                    ('博物馆', 'n', 3000),
                    ('艺术', 'n', 3000),
                    ('文化', 'n', 3000),
                    ('历史', 'n', 3000),
                    ('展览', 'n', 3000),
                    ('收藏', 'v', 3000),
                    ('文物', 'n', 3000),
                    ('古代', 'n', 3000),
                    ('现代', 'n', 3000),
                    ('传统', 'n', 3000),
                    ('创新', 'v', 3000),
                    ('教育', 'n', 3000),
                    ('保护', 'v', 3000),
                    ('研究', 'v', 3000),
                    ('展示', 'v', 3000)
                ]
            
    def _initialize_jieba(self):
        """初始化jieba分词器"""
        try:
            # 尝试加载自定义词典（如果存在）
            jieba.initialize()
            
            # 添加专业术语和专有名词
            word_count = 0
            for word, pos, freq in self.custom_words:
                jieba.add_word(word, freq=freq, tag=pos)
                word_count += 1
                
            # 调整分词模式
            jieba.suggest_freq(('是', '的'), True)
            jieba.suggest_freq(('在', '中'), True)
            jieba.suggest_freq(('进行', '研究'), True)
            
            logger.info(f"jieba分词器初始化成功，添加了 {word_count} 个自定义词条")
            self.jieba_initialized = True
            
        except Exception as e:
            logger.error(f"jieba初始化失败: {str(e)}")
            self.jieba_initialized = False
            
    def _initialize_nlp(self):
        """初始化NLP模型和分词器"""
        try:
            # 加载spacy模型（用于主要语言）
            self.nlp = {
                'en': spacy.load('en_core_web_sm'),
                'de': spacy.load('de_core_news_sm'),
                'fr': spacy.load('fr_core_news_sm'),
                'es': spacy.load('es_core_news_sm'),
                'it': spacy.load('it_core_news_sm')  # 添加意大利语支持
            }
            logger.info("spacy模型加载成功")
        except OSError as e:
            logger.warning(f"spacy模型加载失败: {str(e)}")
            logger.info("请运行以下命令安装必要的模型:")
            logger.info("python -m spacy download en_core_web_sm")
            logger.info("python -m spacy download de_core_news_sm")
            logger.info("python -m spacy download fr_core_news_sm")
            logger.info("python -m spacy download es_core_news_sm")
            logger.info("python -m spacy download it_core_news_sm")  # 添加意大利语模型提示
            self.nlp = {}
            
        try:
            # 初始化韩语分词器
            import os
            import tempfile
            
            # 创建临时目录用于存放 Java 相关文件
            temp_dir = tempfile.mkdtemp(prefix='konlpy_')
            os.environ['JAVA_OPTS'] = f'-Djava.io.tmpdir={temp_dir}'
            
            try:
                from konlpy.tag import Kkma
                self.korean_tokenizer = Kkma()
                logger.info("韩语分词器(Kkma)初始化成功")
            except Exception as e:
                if "jpype jar must be ascii" in str(e):
                    logger.error("由于路径包含非ASCII字符，韩语分词器初始化失败。建议将项目移动到纯英文路径下。")
                else:
                    logger.error(f"韩语分词器初始化失败: {str(e)}")
                self.korean_tokenizer = None
                
        except Exception as e:
            logger.error(f"韩语分词器初始化失败: {str(e)}")
            self.korean_tokenizer = None
            
    def _clean_text(self, text: str) -> str:
        """清理文本，去除多余的空白字符"""
        if not text:
            return ""
        # 规范化空白字符
        text = re.sub(r'\s+', ' ', text)
        # 去除首尾空白
        text = text.strip()
        # 处理全角字符
        text = unicodedata.normalize('NFKC', text)
        return text
        
    def detect_language(self, text: str) -> Tuple[str, float]:
        """使用langdetect进行语言检测"""
        text = self._clean_text(text)
        if not text:
            return ('en', 1.0)
            
        try:
            # 使用langdetect进行语言检测
            langs = detect_langs(text)
            if langs:
                # 获取最可能的语言和其置信度
                lang = langs[0]
                logger.debug(f"语言检测结果: {lang.lang}, 置信度: {lang.prob}")
                return (lang.lang, lang.prob)
            else:
                # 如果检测失败，使用备用方案
                backup_lang = self._detect_by_charset(text)
                logger.debug(f"使用字符集检测，结果: {backup_lang}")
                return backup_lang, 0.5
                
        except Exception as e:
            logger.error(f"语言检测失败: {str(e)}")
            backup_lang = self._detect_by_charset(text)
            return backup_lang, 0.5
            
    def tokenize_text(self, text: str, lang_code: str = None) -> List[str]:
        """根据语言选择合适的分词器"""
        text = self._clean_text(text)
        if not text:
            return []
            
        if lang_code is None:
            lang_code, _ = self.detect_language(text)
            
        logger.debug(f"分词语言: {lang_code}, 文本长度: {len(text)}")
        
        tokens = []
        try:
            if lang_code == 'zh' and self.jieba_initialized:
                tokens = list(jieba.cut(text))
                logger.debug("使用jieba分词器")
            elif lang_code == 'ja':
                tokens = self.segmenter.tokenize(text)
                logger.debug("使用TinySegmenter分词器")
            elif lang_code == 'ko' and self.korean_tokenizer:
                tokens = [token[0] for token in self.korean_tokenizer.pos(text)]
                logger.debug("使用Kkma韩语分词器")
            elif lang_code == 'th':
                tokens = thai_tokenize(text)
                logger.debug("使用泰语分词器")
            elif lang_code in self.nlp:
                doc = self.nlp[lang_code](text)
                tokens = [token.text for token in doc]
                logger.debug(f"使用spacy {lang_code}分词器")
            else:
                tokens = nltk.word_tokenize(text)
                logger.debug("使用nltk分词器")
                
            # 过滤空token
            tokens = [t for t in tokens if self._clean_text(t)]
            logger.debug(f"分词结果: {len(tokens)} 个token")
            return tokens
            
        except Exception as e:
            logger.error(f"分词失败: {str(e)}")
            return self._rule_based_tokenize(text)
            
    def semantic_split(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """将文本分解为适合embedding的语义块"""
        text = self._clean_text(text)
        if not text:
            return []
            
        lang_code, _ = self.detect_language(text)
        logger.info(f"语义分块 - 语言: {lang_code}, 文本长度: {len(text)}")
        
        try:
            chunks = []
            current_chunk = ""
            
            # 根据语言选择分句方式
            if lang_code == 'zh':
                sentences = re.split(r'([。！？])', text)
            elif lang_code == 'ja':
                sentences = re.split(r'([。！？])', text)
            else:
                sentences = nltk.sent_tokenize(text)
                
            for sentence in sentences:
                sentence = self._clean_text(sentence)
                if not sentence:
                    continue
                    
                if len(current_chunk) + len(sentence) > chunk_size:
                    if current_chunk:
                        chunks.append(current_chunk)
                    current_chunk = sentence
                else:
                    current_chunk += (" " if current_chunk else "") + sentence
                    
            # 添加最后一个块
            if current_chunk:
                chunks.append(current_chunk)
                
            logger.info(f"生成了 {len(chunks)} 个语义块")
            return chunks
            
        except Exception as e:
            logger.error(f"语义分块失败: {str(e)}")
            # 降级到简单的字符分割
            return [text[i:i+chunk_size] for i in range(0, len(text), chunk_size-overlap)]
        
    def _detect_by_charset(self, text: str) -> str:
        """基于字符集的语言检测（作为备用）"""
        total_chars = len(text)
        if total_chars == 0:
            return 'en'
            
        # 统计各种字符的数量
        chinese_chars = sum(1 for char in text if '\u4e00' <= char <= '\u9fff')
        japanese_chars = sum(1 for char in text if ('\u3040' <= char <= '\u309f') or ('\u30a0' <= char <= '\u30ff'))
        korean_chars = sum(1 for char in text if '\uac00' <= char <= '\ud7a3')
        thai_chars = sum(1 for char in text if '\u0e00' <= char <= '\u0e7f')
        
        # 计算比例
        ratios = {
            'zh': chinese_chars / total_chars,
            'ja': japanese_chars / total_chars,
            'ko': korean_chars / total_chars,
            'th': thai_chars / total_chars
        }
        
        # 如果有明显主导语言，返回该语言
        max_ratio = max(ratios.values())
        if max_ratio > 0.2:
            return max(ratios.items(), key=lambda x: x[1])[0]
            
        return 'en'
        
    def count_tokens(self, text: str) -> int:
        """计算文本的token数量"""
        text = self._clean_text(text)
        if not text:
            return 0
            
        try:
            # 1. 检测语言
            lang_code, confidence = self.detect_language(text)
            logger.info(f"计算token - 语言: {lang_code}, 置信度: {confidence:.2f}")
            
            # 2. 分词
            tokens = self.tokenize_text(text, lang_code)
            
            # 3. 特殊处理
            processed_tokens = []
            for token in tokens:
                # 处理数字
                if re.match(r'^\d+$', token):
                    # 每4个数字算作一个token
                    processed_tokens.extend(['0'] * ((len(token) + 3) // 4))
                # 处理URL
                elif re.match(r'^https?://', token):
                    # URL按组件计算
                    parts = re.split(r'[/\?=&]', token)
                    processed_tokens.extend(['url_part'] * len(parts))
                # 处理邮箱
                elif re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', token):
                    processed_tokens.extend(['email'] * 3)
                # 处理其他token
                else:
                    # 对于CJK字符，每个字符算一个token
                    if any('\u4e00' <= char <= '\u9fff' or  # 中文
                          '\u3040' <= char <= '\u309f' or   # 平假名
                          '\u30a0' <= char <= '\u30ff' or   # 片假名
                          '\uac00' <= char <= '\ud7a3'      # 韩文
                          for char in token):
                        processed_tokens.extend(list(token))
                    else:
                        processed_tokens.append(token)
            
            token_count = len(processed_tokens)
            logger.info(f"总token数: {token_count}")
            logger.debug(f"token示例: {processed_tokens[:10]}")
            
            return token_count
            
        except Exception as e:
            logger.error(f"Token计算错误: {str(e)}")
            # 如果分词失败，使用保守的估计方法
            return len(text.split())
            
    def calculate_image_tokens(self, image_data):
        """计算图片的token数量"""
        if not image_data:
            logger.info("未提供图片数据，使用默认token数 (65)")
            return 65
            
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
                
                logger.info(f"图片大小: {size_mb:.2f}MB, Token数: {tokens}")
                return tokens
                
            else:
                logger.warning("不支持的图片数据格式，使用默认token数 (65)")
                return 65
                
        except Exception as e:
            logger.error(f"计算图片token出错: {str(e)}")
            return 65  # 出错时按最小值计算

    def estimate_tokens(self, messages):
        """估算消息列表的token数量"""
        input_tokens = 0
        output_tokens = 0
        
        try:
            for message in messages:
                content = message.get('content', '')
                role = message.get('role', '')
                
                # 处理content可能是列表的情况（OpenAI格式）
                if isinstance(content, list):
                    text_content = ''
                    for item in content:
                        if isinstance(item, dict):
                            if item.get('type') == 'text':
                                text_content += item.get('text', '')
                    content = text_content
                
                # 处理parts可能存在的情况（Google格式）
                if 'parts' in message:
                    parts_content = []
                    for part in message['parts']:
                        if isinstance(part, dict) and 'text' in part:
                            parts_content.append(part['text'])
                    content += ' '.join(parts_content)
                
                tokens = self.count_tokens(str(content))
                logger.debug(f"角色: {role}, Token数: {tokens}")
                
                if role == 'assistant':
                    output_tokens += tokens
                else:
                    input_tokens += tokens
            
            logger.info(f"总计 - 输入Token: {input_tokens}, 输出Token: {output_tokens}")
            return input_tokens, output_tokens
            
        except Exception as e:
            logger.error(f"Token估算错误: {str(e)}")
            return 0, 0

    def get_semantic_tokens(self, text: str) -> List[str]:
        """获取语义token（用于embedding）"""
        text = self._clean_text(text)
        if not text:
            return []
            
        lang_code, confidence = self.detect_language(text)
        logger.info(f"获取语义token - 语言: {lang_code}, 置信度: {confidence:.2f}")
        
        try:
            if lang_code == 'zh' and self.jieba_initialized:
                # 中文使用jieba的词性标注
                import jieba.posseg as pseg
                words = list(pseg.cut(text))
                tokens = []
                current_phrase = ""
                i = 0
                
                while i < len(words):
                    word, flag = words[i]
                    
                    # 1. 处理专有名词和机构名
                    if flag in ['nr', 'ns', 'nt', 'nz']:
                        # 处理连续的专有名词
                        entity = word
                        j = i + 1
                        while j < len(words) and words[j].flag in ['nr', 'ns', 'nt', 'nz', 'n']:
                            # 如果下一个词是相关的名词，合并它
                            next_word = words[j].word
                            if (entity + next_word in [w for w, _, _ in self.custom_words] or
                                len(next_word) >= 2):  # 对于较长的词更可能是专有名词的一部分
                                entity += next_word
                                j += 1
                            else:
                                break
                                
                        if current_phrase:
                            tokens.append(current_phrase)
                            current_phrase = ""
                        tokens.append(f"<ENT>{entity}</ENT>")
                        i = j
                        continue
                    
                    # 2. 处理技术术语和专业词汇
                    if flag == 'n' and i + 1 < len(words):
                        next_word, next_flag = words[i + 1]
                        compound_word = word + next_word
                        
                        # 检查是否是预定义的专业术语
                        if compound_word in [w for w, _, _ in self.custom_words]:
                            if current_phrase:
                                tokens.append(current_phrase)
                                current_phrase = ""
                            tokens.append(f"<TERM>{compound_word}</TERM>")
                            i += 2
                            continue
                        # 检查是否是可能的技术术语组合
                        elif next_flag in ['n', 'vn'] and len(compound_word) >= 4:
                            if current_phrase:
                                tokens.append(current_phrase)
                                current_phrase = ""
                            tokens.append(compound_word)
                            i += 2
                            continue
                    
                    # 3. 处理动词短语
                    if flag == 'v' and i + 1 < len(words):
                        next_word, next_flag = words[i + 1]
                        if next_flag in ['n', 'v', 'vn']:
                            # 合并动词和其宾语
                            phrase = word + next_word
                            if current_phrase:
                                tokens.append(current_phrase)
                                current_phrase = ""
                            tokens.append(phrase)
                            i += 2
                            continue
                    
                    # 4. 处理普通词
                    if flag in ['n', 'v', 'a', 'vn']:
                        if current_phrase:
                            tokens.append(current_phrase)
                            current_phrase = ""
                        tokens.append(word)
                    else:
                        current_phrase += word
                    
                    i += 1
                
                # 处理最后的短语
                if current_phrase:
                    tokens.append(current_phrase)
                    
            elif lang_code in self.nlp:
                # 使用spacy进行语义分析
                doc = self.nlp[lang_code](text)
                tokens = []
                
                for token in doc:
                    # 保持命名实体的完整性
                    if token.ent_type_:
                        if tokens and tokens[-1].startswith('<ENT>'):
                            tokens[-1] = tokens[-1][:-6] + " " + token.text + "</ENT>"
                        else:
                            tokens.append(f"<ENT>{token.text}</ENT>")
                    # 处理欧洲语言的特殊情况
                    elif lang_code in ['fr', 'de', 'es', 'it']:
                        # 处理复合词（德语特有）
                        if lang_code == 'de' and token.dep_ == 'compound':
                            if tokens:
                                tokens[-1] = tokens[-1] + token.text
                            else:
                                tokens.append(token.text)
                        # 处理冠词缩写（法语和意大利语特有）
                        elif lang_code in ['fr', 'it'] and token.pos_ == 'DET' and "'" in token.text:
                            tokens.append(token.text)
                        # 处理动词代词（西班牙语和意大利语特有）
                        elif lang_code in ['es', 'it'] and token.pos_ == 'PRON' and token.dep_ == 'obj':
                            if tokens and tokens[-1].endswith('r'):  # 可能是不定式动词
                                tokens[-1] = tokens[-1] + token.text
                            else:
                                tokens.append(token.text)
                        # 保持复合词的完整性
                        elif token.dep_ in ['compound', 'amod'] and tokens:
                            tokens[-1] = tokens[-1] + " " + token.text
                        else:
                            tokens.append(token.text)
                    else:
                        tokens.append(token.text)
            else:
                # 其他语言使用基本分词
                tokens = self.tokenize_text(text, lang_code)
            
            # 清理并过滤token
            tokens = [self._clean_text(t) for t in tokens]
            tokens = [t for t in tokens if t]
            
            logger.info(f"生成了 {len(tokens)} 个语义token")
            logger.debug(f"前10个token示例: {tokens[:10]}")
            
            return tokens
            
        except Exception as e:
            logger.error(f"语义token提取错误: {str(e)}")
            return self.tokenize_text(text, lang_code)

    def _rule_based_tokenize(self, text: str) -> List[str]:
        """基于规则的分词（用于不支持的语言）"""
        text = self._clean_text(text)
        if not text:
            return []
            
        try:
            # 1. 分割标点符号
            text = re.sub(r'([.,!?(){}[\]<>:;])', r' \1 ', text)
            
            # 2. 处理特殊情况
            # 保持货币符号和数字在一起
            text = re.sub(r'(\$|€|£|¥)(\d+)', r'\1 \2', text)
            # 保持缩写完整
            text = re.sub(r'(\w)\.(\w)\.', r'\1\2', text)
            # 处理连字符
            text = re.sub(r'(\w)-(\w)', r'\1 - \2', text)
            
            # 3. 分词并过滤空字符串
            tokens = [t for t in text.split() if self._clean_text(t)]
            
            logger.debug(f"规则分词结果: {len(tokens)} 个token")
            return tokens
            
        except Exception as e:
            logger.error(f"规则分词失败: {str(e)}")
            return text.split()

    def calculate_semantic_density(self, text: str) -> float:
        """计算文本的语义密度，支持多语言"""
        text = self._clean_text(text)
        if not text:
            return 0.0
            
        try:
            # 检测语言
            lang_code, _ = self.detect_language(text)
            logger.info(f"计算语义密度 - 语言: {lang_code}")
            
            # 初始化计数器
            content_words = 0
            total_words = 0
            semantic_markers = 0
            technical_terms = 0
            
            if lang_code == 'zh' and self.jieba_initialized:
                # 中文分析
                words = list(pseg.cut(text))
                total_words = len(words)
                
                # 统计实义词（名词、动词、形容词等）
                content_words = sum(1 for w, flag in words if flag in ['n', 'v', 'a', 'vn', 'nz'])
                
                # 统计语义标记（连词等）
                semantic_markers = sum(1 for w, _ in words if w in [
                    '因此', '所以', '但是', '然而', '不过', '虽然', '尽管', '如果', '假如',
                    '由于', '因为', '而且', '并且', '或者', '即使', '无论', '除了', '不仅'
                ])
                
                # 统计专业术语
                technical_terms = sum(1 for w, _ in words if w in [term for term, _, _ in self.custom_words])
                
            elif lang_code == 'ja':
                # 日语分析
                tokens = self.segmenter.tokenize(text)
                total_words = len(tokens)
                
                # 日语连词和语义标记
                ja_markers = ['しかし', 'けれども', 'だから', 'それで', 'また', 'および',
                            'あるいは', 'ただし', 'なぜなら', 'したがって']
                semantic_markers = sum(1 for t in tokens if t in ja_markers)
                
                # 使用形态素分析统计实义词
                content_words = sum(1 for t in tokens if any(char.isalpha() for char in t))
                
            elif lang_code == 'ko' and self.korean_tokenizer:
                # 韩语分析
                pos_tags = self.korean_tokenizer.pos(text)
                total_words = len(pos_tags)
                
                # 韩语词性标注中的实义词
                content_tags = ['NNG', 'NNP', 'VV', 'VA', 'VX']
                content_words = sum(1 for _, tag in pos_tags if tag in content_tags)
                
                # 韩语连词和语义标记
                ko_markers = ['그러나', '하지만', '그리고', '또는', '왜냐하면', '따라서']
                semantic_markers = sum(1 for word, _ in pos_tags if word in ko_markers)
                
            elif lang_code in self.nlp:
                # 使用spacy进行分析（英语和欧洲语言）
                doc = self.nlp[lang_code](text)
                total_words = len(doc)
                
                # 统计实义词
                content_words = sum(1 for token in doc if not token.is_stop and token.pos_ in 
                                  ['NOUN', 'VERB', 'ADJ', 'PROPN'])
                
                # 统计连词和语义标记
                semantic_markers = sum(1 for token in doc if token.dep_ in 
                                    ['mark', 'cc', 'prep'] or token.pos_ == 'SCONJ')
                
                # 针对不同欧洲语言的特殊处理
                if lang_code == 'de':
                    # 德语复合词处理
                    technical_terms = sum(1 for token in doc if (
                        token.pos_ == 'PROPN' or 
                        (token.pos_ == 'NOUN' and len(token.text) > 10) or  # 长复合词
                        (token.pos_ == 'NOUN' and any(child.pos_ == 'NOUN' for child in token.children))
                    ))
                elif lang_code == 'fr':
                    # 法语专业术语识别
                    technical_terms = sum(1 for token in doc if (
                        token.pos_ == 'PROPN' or
                        (token.pos_ == 'NOUN' and any(child.pos_ == 'ADJ' for child in token.children)) or
                        (token.text.endswith(('tion', 'ment', 'age', 'isme')) and token.pos_ == 'NOUN')
                    ))
                elif lang_code == 'es':
                    # 西班牙语专业术语识别
                    technical_terms = sum(1 for token in doc if (
                        token.pos_ == 'PROPN' or
                        (token.pos_ == 'NOUN' and any(child.pos_ == 'ADJ' for child in token.children)) or
                        (token.text.endswith(('ción', 'miento', 'idad', 'ismo')) and token.pos_ == 'NOUN')
                    ))
                elif lang_code == 'it':
                    # 意大利语专业术语识别
                    technical_terms = sum(1 for token in doc if (
                        token.pos_ == 'PROPN' or
                        (token.pos_ == 'NOUN' and any(child.pos_ == 'ADJ' for child in token.children)) or
                        (token.text.endswith(('zione', 'mento', 'ità', 'ismo')) and token.pos_ == 'NOUN')
                    ))
                else:
                    # 其他语言的通用处理
                    technical_terms = sum(1 for token in doc if (
                        token.pos_ == 'PROPN' or 
                        (token.pos_ == 'NOUN' and any(child.pos_ == 'NOUN' for child in token.children))
                    ))
            
            # 计算综合语义密度分数
            content_ratio = content_words / total_words if total_words > 0 else 0
            marker_density = semantic_markers / len(text) if text else 0
            term_density = technical_terms / total_words if total_words > 0 else 0
            
            # 加权计算最终密度
            semantic_density = (
                content_ratio * 0.5 +  # 实义词比重
                marker_density * 0.3 + # 语义标记比重
                term_density * 0.2     # 专业术语比重
            )
            
            logger.debug(f"语义密度分析 - 实义词比例: {content_ratio:.2f}, "
                        f"标记密度: {marker_density:.2f}, "
                        f"术语密度: {term_density:.2f}")
            
            return semantic_density
            
        except Exception as e:
            logger.error(f"计算语义密度时出错: {str(e)}")
            return 0.0

    def get_sentence_boundaries(self, text: str) -> List[int]:
        """获取文本中的句子边界位置，支持多语言"""
        text = self._clean_text(text)
        if not text:
            return []
            
        try:
            # 检测语言
            lang_code, _ = self.detect_language(text)
            
            # 定义不同语言的句子结束标记
            endings = {
                'zh': ['。', '！', '？', '…'],  # 中文
                'ja': ['。', '！', '？', '…', '．'],  # 日语
                'ko': ['.', '!', '?', '。', '！', '？'],  # 韩语
                'default': ['.', '!', '?', ';']  # 英语和其他西欧语言
            }
            
            # 获取当前语言的句子结束标记
            current_endings = endings.get(lang_code, endings['default'])
            
            # 查找所有句子边界
            boundaries = []
            for i, char in enumerate(text):
                if char in current_endings:
                    boundaries.append(i + 1)
                    
            return boundaries
            
        except Exception as e:
            logger.error(f"获取句子边界时出错: {str(e)}")
            return []

    def calculate_punctuation_density(self, text: str) -> float:
        """计算标点符号密度，支持多语言"""
        text = self._clean_text(text)
        if not text:
            return 0.0
            
        try:
            # 检测语言
            lang_code, _ = self.detect_language(text)
            
            # 定义不同语言的标点符号集合
            punctuation_sets = {
                'zh': '，。；：！？、（）【】《》""''',  # 中文标点
                'ja': '、。，．・？！；：「」『』（）',  # 日语标点
                'ko': '.,!?;:()[]{}""\'\'',  # 韩语和英语标点
                'default': '.,!?;:()[]{}""\'\'<>-'  # 默认标点
            }
            
            # 获取当前语言的标点符号集合
            current_puncts = punctuation_sets.get(lang_code, punctuation_sets['default'])
            
            # 统计标点符号数量
            punct_count = sum(1 for char in text if char in current_puncts)
            
            # 计算密度
            density = punct_count / len(text) if text else 0
            
            return density
            
        except Exception as e:
            logger.error(f"计算标点符号密度时出错: {str(e)}")
            return 0.0

# 添加错误处理，如果资源仍然无法加载，使用备用方案
def word_tokenize_safe(text):
    try:
        return nltk.word_tokenize(text)
    except LookupError:
        # 备用方案：简单的空格分词
        return text.split()
