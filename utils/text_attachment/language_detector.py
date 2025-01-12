from typing import Dict, List, Tuple, Optional
from langdetect import detect, detect_langs
from langdetect.detector_factory import DetectorFactory
import matplotlib.pyplot as plt
import morfessor

class LanguageDetector:

    # 语言代码标准化映射
    LANGUAGE_CODE_MAP = {
        # 中文变体
        'zh-cn': 'zh',
        'zh-tw': 'zh',
        'zh-hk': 'zh',
        'zh-sg': 'zh',
        'zh-hans': 'zh',
        'zh-hant': 'zh',
        # 英文变体
        'en-us': 'en',
        'en-gb': 'en',
        'en-au': 'en',
        'en-ca': 'en',
        # 法语变体
        'fr-fr': 'fr',
        'fr-ca': 'fr',
        'fr-be': 'fr',
        'fr-ch': 'fr',
        # 德语变体
        'de-de': 'de',
        'de-at': 'de',
        'de-ch': 'de',
        # 西班牙语变体
        'es-es': 'es',
        'es-mx': 'es',
        'es-ar': 'es',
        # 葡萄牙语变体
        'pt-pt': 'pt',
        'pt-br': 'pt',
        # 俄语变体
        'ru-ru': 'ru',
    }


    # Unicode映射表
    UNICODE_RANGES = {
        'zh': {
            'ranges': [
                (0x4E00, 0x9FFF),   # CJK统一汉字
                (0x3400, 0x4DBF),   # CJK扩展A
                (0x20000, 0x2A6DF), # CJK扩展B
                (0x2A700, 0x2B73F), # CJK扩展C
                (0x2B740, 0x2B81F), # CJK扩展D
            ],
            'weights': {}  # 中文字符权重都是1
        },
        'ja': {
            'ranges': [
                (0x3040, 0x309F),   # 平假名
                (0x30A0, 0x30FF),   # 片假名
                (0x4E00, 0x9FFF),   # 汉字（与中文共享）
                (0x31F0, 0x31FF),   # 片假名语音扩展
            ],
            'weights': {}  # 日文字符权重都是1
        },
        'ko': {
            'ranges': [
                (0xAC00, 0xD7AF),   # 谚文音节
                (0x1100, 0x11FF),   # 谚文字母
                (0x3130, 0x318F),   # 谚文兼容字母
                (0xA960, 0xA97F),   # 谚文扩展-A
            ],
            'weights': {}  # 韩文字符权重都是1
        },
        'en': {
            'ranges': [
                (0x0041, 0x005A),   # 大写拉丁字母
                (0x0061, 0x007A),   # 小写拉丁字母
            ],
            'weights': {}  # 英文字符权重都是1
        },
        'ru': {
            'ranges': [
                (0x0410, 0x044F),   # 西里尔字母
                (0x0401, 0x0401),   # Ё
                (0x0451, 0x0451),   # ё
            ],
            'weights': {
                frozenset([0x0401, 0x0451]): 2.0  # Ё ё
            }
        },
        'fr': {
            'ranges': [
                (0x0041, 0x005A),   # 基本拉丁字母
                (0x0061, 0x007A),
                (0x00C0, 0x00C2),   # À Á Â
                (0x00C7, 0x00C7),   # Ç
                (0x00C8, 0x00CB),   # È É Ê Ë
                (0x00CE, 0x00CF),   # Î Ï
                (0x00D4, 0x00D4),   # Ô
                (0x00D9, 0x00DC),   # Ù Ú Û Ü
                (0x00E0, 0x00E2),   # à á â
                (0x00E7, 0x00E7),   # ç
                (0x00E8, 0x00EB),   # è é ê ë
                (0x00EE, 0x00EF),   # î ï
                (0x00F4, 0x00F4),   # ô
                (0x00F9, 0x00FC),   # ù ú û ü
                (0x0152, 0x0153),   # Œ œ
                (0x0178, 0x0178),   # Ÿ
            ],
            'weights': {
                frozenset([0x00E0, 0x00E2, 0x00E7, 0x00E8, 0x00E9, 0x00EA, 0x00EB, 0x00EE, 0x00EF, 0x00F4, 0x00F9, 0x00FB, 0x00FC]): 3.0,  # àâçèéêëîïôùûü
                frozenset([0x0152, 0x0153, 0x0178]): 2.0,  # Œœ
            }
        },
        'de': {
            'ranges': [
                (0x0041, 0x005A),   # 基本拉丁字母
                (0x0061, 0x007A),
                (0x00C4, 0x00C4),   # Ä
                (0x00D6, 0x00D6),   # Ö
                (0x00DC, 0x00DC),   # Ü
                (0x00E4, 0x00E4),   # ä
                (0x00F6, 0x00F6),   # ö
                (0x00FC, 0x00FC),   # ü
                (0x00DF, 0x00DF),   # ß
            ],
            'weights': {
                frozenset([0x00C4, 0x00D6, 0x00DC, 0x00E4, 0x00F6, 0x00FC]): 3.0,  # ÄÖÜäöü
                frozenset([0x00DF]): 2.0,  # ß
            }
        },
        'th': {
            'ranges': [
                (0x0E00, 0x0E7F),   # 泰文
            ],
            'weights': {}  # 泰文字符权重都是1
        },
        'es': {
            'ranges': [
                (0x0041, 0x005A),   # 基本拉丁字母
                (0x0061, 0x007A),
                (0x00C1, 0x00C1),   # Á
                (0x00C9, 0x00C9),   # É
                (0x00CD, 0x00CD),   # Í
                (0x00D1, 0x00D1),   # Ñ
                (0x00D3, 0x00D3),   # Ó
                (0x00DA, 0x00DA),   # Ú
                (0x00DC, 0x00DC),   # Ü
                (0x00E1, 0x00E1),   # á
                (0x00E9, 0x00E9),   # é
                (0x00ED, 0x00ED),   # í
                (0x00F1, 0x00F1),   # ñ
                (0x00F3, 0x00F3),   # ó
                (0x00FA, 0x00FA),   # ú
                (0x00FC, 0x00FC),   # ü
                (0x00A1, 0x00A1),   # ¡
                (0x00BF, 0x00BF),   # ¿
            ],
            'weights': {
                frozenset([0x00BF, 0x00A1]): 5.0,  # ¿¡
                frozenset([0x00F1, 0x00D1]): 3.0,  # ñÑ
                frozenset([0x00E1, 0x00E9, 0x00ED, 0x00F3, 0x00FA]): 2.0,  # áéíóú
            }
        },
        'it': {
            'ranges': [
                (0x0041, 0x005A),   # 基本拉丁字母
                (0x0061, 0x007A),
                (0x00C0, 0x00C0),   # À
                (0x00C8, 0x00C9),   # È É
                (0x00CC, 0x00CD),   # Ì Í
                (0x00D2, 0x00D3),   # Ò Ó
                (0x00D9, 0x00DA),   # Ù Ú
                (0x00E0, 0x00E0),   # à
                (0x00E8, 0x00E9),   # è é
                (0x00EC, 0x00ED),   # ì í
                (0x00F2, 0x00F3),   # ò ó
                (0x00F9, 0x00FA),   # ù ú
            ],
            'weights': {
                frozenset([0x00E0, 0x00E8, 0x00EC, 0x00F2, 0x00F9]): 2.0,  # àèìòù
            }
        },
    }

    def __init__(self, window_size: int = 10):
        # 设置随机种子以确保结果一致性
        DetectorFactory.seed = 0
        # 初始化morfessor模型用于分词
        self.morfessor_model = morfessor.BaselineModel()
        # 设置滑动窗口大小
        self.window_size = window_size
        
    def preprocess_text(self, text: str) -> str:
        """预处理文本，移除可能影响语言检测的特殊格式
        
        Args:
            text: 原始文本
            
        Returns:
            处理后的文本
        """
        import re
        
        # 移除URL
        text = re.sub(r'https?://\S+|www\.\S+', ' ', text)
        
        # 移除完整的邮箱地址
        text = re.sub(r'\S+@\S+', ' ', text)
        
        # 移除域名（包括子域名）和后缀
        text = re.sub(r'\S+\.(com|org|net|edu|gov|cn|jp|kr|uk|de|fr|ru|br|io|ai|app|dev|cloud|me|co|biz|info|xyz)\b', ' ', text, flags=re.IGNORECASE)
        
        # 移除特殊符号（保留有语义的标点如.,!?，。！？等）
        text = re.sub(r'[@#$%^&*+=`~<>{}|\\/]+', ' ', text)
        
        # 移除独立的数字（但保留带字母的混合文本）
        text = re.sub(r'\b\d+\b', ' ', text)
        
        # 移除多余的空白字符
        text = re.sub(r'\s+', ' ', text).strip()
        
        print(f"预处理步骤:\n原始文本: {text}")  # 调试输出
        
        return text

    def fallback_detect(self, text: str) -> str:
        """基于Unicode范围的保底语言检测
        
        Args:
            text: 待检测文本
            
        Returns:
            最可能的语言代码
        """
        if not text:
            return 'en'

        # 统计每种语言的字符/单词数
        lang_counts = {lang: 0.0 for lang in self.UNICODE_RANGES.keys()}  # 改为float以支持权重
        total_units = 0  # 总计数单位（字符或单词）

        # 西欧语言集合
        western_langs = {'en', 'fr', 'de', 'es', 'it'}
        
        # 临时存储西欧字母序列
        current_word = []
        
        def process_western_word():
            """处理收集到的西欧单词"""
            if not current_word:
                return 0
                
            word = ''.join(current_word)
            if len(word) == 0:
                current_word.clear()
                return 0

            # 统计单词中每种语言的特征
            word_lang_scores = {lang: 0.0 for lang in western_langs}
            
            # 先检查特征字符
            for char in word:
                code_point = ord(char)
                for lang in western_langs:
                    # 检查特征权重
                    for chars, weight in self.UNICODE_RANGES[lang]['weights'].items():
                        if code_point in chars:
                            word_lang_scores[lang] += weight
                            
            # 如果没有特征字符，就按普通字母计数
            if all(score == 0 for score in word_lang_scores.values()):
                for lang in western_langs:
                    for char in word:
                        code_point = ord(char)
                        for start, end in self.UNICODE_RANGES[lang]['ranges']:
                            if start <= code_point <= end:
                                word_lang_scores[lang] += 1
                                break
            
            # 找出得分最高的语言
            max_score = max(word_lang_scores.values())
            if max_score > 0:
                # 如果有特征分数，只给最高分的语言加分
                max_langs = [lang for lang, score in word_lang_scores.items() if score == max_score]
                if len(max_langs) == 1:
                    lang_counts[max_langs[0]] += max_score
                else:
                    # 如果多个语言得分相同，给每个语言加1分
                    for lang in max_langs:
                        lang_counts[lang] += 1

            current_word.clear()
            return 1

        for char in text:
            code_point = ord(char)
            is_western = False
            
            # 检查是否是西欧字母
            for lang in western_langs:
                for start, end in self.UNICODE_RANGES[lang]['ranges']:
                    if start <= code_point <= end:
                        current_word.append(char)
                        is_western = True
                        break
                if is_western:
                    break
            
            # 如果不是西欧字母，处理之前收集的西欧单词
            if not is_western:
                total_units += process_western_word()
                # 检查是否是其他语言的字符
                for lang, config in self.UNICODE_RANGES.items():
                    if lang not in western_langs:
                        for start, end in config['ranges']:
                            if start <= code_point <= end:
                                # 检查是否有特征权重
                                weight = 1.0
                                for chars, w in config['weights'].items():
                                    if code_point in chars:
                                        weight = w
                                        break
                                lang_counts[lang] += weight
                                total_units += 1
                                break
        
        # 处理最后一个西欧单词
        total_units += process_western_word()

        if total_units == 0:
            return 'en'

        # 计算每种语言的占比
        lang_ratios = {
            self.normalize_language_code(lang): count / total_units  # 对语言代码进行标准化
            for lang, count in lang_counts.items() 
            if count > 0
        }

        # 如果没有任何匹配的语言，返回默认值
        if not lang_ratios:
            return 'en'

        # 返回占比最高的语言
        return max(lang_ratios.items(), key=lambda x: x[1])[0]

    def normalize_language_code(self, lang_code: str) -> str:
        """标准化语言代码
        
        Args:
            lang_code: 原始语言代码
            
        Returns:
            标准化后的语言代码
        """
        # 转换为小写并去除空白
        lang_code = lang_code.lower().strip()
        # 从映射表中获取标准代码，如果不存在则返回原始代码
        return self.LANGUAGE_CODE_MAP.get(lang_code, lang_code)

    def detect(self, text: str) -> Tuple[str, float]:
        """使用语言检测并可视化结果
        
        Args:
            text: 待检测的文本
            
        Returns:
            Tuple[str, float]: 包含标准化的语言代码和置信度的元组
        """
        try:
            # 预处理文本
            processed_text = self.preprocess_text(text)
            print(f"预处理后的文本: {processed_text}")
            
            # 如果预处理后文本为空，使用原始文本进行fallback检测
            if not processed_text.strip():
                print("预处理后文本为空，使用原始文本进行Fallback检测")
                return self.fallback_detect(text), 1.0
            
            # 使用langdetect进行初步检测
            langs = detect_langs(processed_text)
            
            # 获取语言和置信度
            languages = [self.normalize_language_code(lang.lang) for lang in langs]  # 对每个语言代码进行标准化
            probabilities = [lang.prob for lang in langs]
            
            # 创建饼图
            plt.figure(figsize=(10, 8))
            plt.pie(probabilities, labels=languages, autopct='%1.1f%%')
            plt.title('Language Detection Confidence')
            plt.axis('equal')
            
            # 保存图表
            plt.savefig('language_detection.png')
            plt.close()
            
            # 如果检测失败或置信度低于阈值，使用fallback方法
            CONFIDENCE_THRESHOLD = 0.6  # 置信度阈值
            if not languages or probabilities[0] < CONFIDENCE_THRESHOLD:
                print(f"置信度较低 ({probabilities[0] if probabilities else 0:.3f}) 或检测失败，使用Fallback检测")
                fallback_lang = self.fallback_detect(processed_text)
                # 如果fallback检测结果与原始检测结果不同，返回fallback结果
                if not languages or fallback_lang != languages[0]:
                    return fallback_lang, 1.0
            
            # 返回标准化的语言代码和置信度
            return languages[0], probabilities[0]
            
        except Exception as e:
            # 如果出现任何错误，使用fallback方法
            print(f"检测出错: {str(e)}，使用Fallback检测")
            return self.fallback_detect(text), 1.0