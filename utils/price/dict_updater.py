import logging
import os
import json
import requests
from bs4 import BeautifulSoup
import re
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

class DictUpdater:
    """词典更新器"""
    
    def __init__(self):
        """初始化更新器"""
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.dict_dir = os.path.join(self.base_dir, 'dicts')
        self._ensure_dirs()
        
        # 维基百科API端点
        self.wiki_endpoints = {
            'zh': 'https://zh.wikipedia.org/w/api.php',
            'en': 'https://en.wikipedia.org/w/api.php',
            'ja': 'https://ja.wikipedia.org/w/api.php',
            'ko': 'https://ko.wikipedia.org/w/api.php',
            'th': 'https://th.wikipedia.org/w/api.php',
            'fr': 'https://fr.wikipedia.org/w/api.php',
            'de': 'https://de.wikipedia.org/w/api.php',
            'es': 'https://es.wikipedia.org/w/api.php',
            'it': 'https://it.wikipedia.org/w/api.php'
        }
        
        # 百度百科API端点
        self.baidu_endpoint = 'https://baike.baidu.com/api/openapi/BaikeLemmaCardApi'
        
    def _ensure_dirs(self):
        """确保必要的目录存在"""
        os.makedirs(self.dict_dir, exist_ok=True)
        os.makedirs(os.path.join(self.dict_dir, 'data'), exist_ok=True)
        
    def update_from_wiki(self, keyword: str, lang: str = 'zh', max_terms: int = 100) -> Optional[List[str]]:
        """从维基百科抓取词条"""
        try:
            if lang not in self.wiki_endpoints:
                logger.error(f"不支持的语言: {lang}")
                return None
                
            endpoint = self.wiki_endpoints[lang]
            
            # 构建API请求
            params = {
                'action': 'query',
                'format': 'json',
                'prop': 'extracts|links',
                'titles': keyword,
                'exintro': True,
                'explaintext': True,
                'pllimit': max_terms
            }
            
            response = requests.get(endpoint, params=params)
            data = response.json()
            
            if 'query' not in data or 'pages' not in data['query']:
                logger.warning(f"未找到相关词条: {keyword}")
                return None
                
            terms = set()
            
            # 处理页面内容
            for page in data['query']['pages'].values():
                # 提取链接
                if 'links' in page:
                    for link in page['links']:
                        title = link.get('title', '')
                        if self._is_valid_term(title, lang):
                            terms.add(title)
                            
                # 从摘要中提取关键词
                if 'extract' in page:
                    extract_terms = self._extract_terms(page['extract'], lang)
                    terms.update(extract_terms)
                    
            terms = list(terms)[:max_terms]
            logger.info(f"从维基百科抓取了 {len(terms)} 个词条")
            return terms
            
        except Exception as e:
            logger.error(f"从维基百科抓取词条失败: {str(e)}")
            return None
            
    def update_from_baidu(self, keyword: str, max_terms: int = 100) -> Optional[List[str]]:
        """从百度百科抓取词条"""
        try:
            # 构建API请求
            params = {
                'scope': 1,
                'format': 'json',
                'appid': '379020',
                'bk_key': keyword
            }
            
            response = requests.get(self.baidu_endpoint, params=params)
            data = response.json()
            
            if 'abstract' not in data:
                logger.warning(f"未找到相关词条: {keyword}")
                return None
                
            # 从摘要中提取关键词
            terms = self._extract_terms(data['abstract'], 'zh')
            terms = list(terms)[:max_terms]
            
            logger.info(f"从百度百科抓取了 {len(terms)} 个词条")
            return terms
            
        except Exception as e:
            logger.error(f"从百度百科抓取词条失败: {str(e)}")
            return None
            
    def _is_valid_term(self, term: str, lang: str) -> bool:
        """检查词条是否有效"""
        if not term or len(term) < 2:
            return False
            
        # 检查是否包含特殊字符
        if re.search(r'[^a-zA-Z0-9\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0e00-\u0e7f\u00C0-\u00FF\s-]', term):
            return False
            
        # 语言特定的验证
        if lang == 'zh':
            # 中文词条必须包含至少一个汉字
            if not re.search(r'[\u4e00-\u9fff]', term):
                return False
        elif lang == 'ja':
            # 日语词条必须包含日文字符
            if not re.search(r'[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]', term):
                return False
        elif lang == 'ko':
            # 韩语词条必须包含谚文
            if not re.search(r'[\uac00-\ud7af]', term):
                return False
        elif lang == 'th':
            # 泰语词条必须包含泰文字符
            if not re.search(r'[\u0e00-\u0e7f]', term):
                return False
        elif lang in ['en', 'fr', 'de', 'es', 'it']:
            # 西方语言词条必须包含拉丁字母
            if not re.search(r'[a-zA-Z\u00C0-\u00FF]', term):
                return False
                
        return True
        
    def _extract_terms(self, text: str, lang: str) -> set:
        """从文本中提取词条"""
        terms = set()
        
        # 根据语言选择分词模式
        if lang == 'zh':
            # 中文：2-7个汉字
            pattern = r'[\u4e00-\u9fff]{2,7}'
        elif lang == 'ja':
            # 日语：日文字符（汉字+假名）
            pattern = r'[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]{2,7}'
        elif lang == 'ko':
            # 韩语：谚文
            pattern = r'[\uac00-\ud7af]{2,7}'
        elif lang == 'th':
            # 泰语：泰文字符
            pattern = r'[\u0e00-\u0e7f]{2,7}'
        else:
            # 西方语言：单词或短语
            pattern = r'[a-zA-Z\u00C0-\u00FF][a-zA-Z\u00C0-\u00FF\s-]{1,20}'
            
        matches = re.finditer(pattern, text)
        for match in matches:
            term = match.group().strip()
            if self._is_valid_term(term, lang):
                terms.add(term)
                
        return terms
        
    def save_to_dict(self, terms: List[str], dict_name: str):
        """保存词条到词典文件"""
        try:
            dict_path = os.path.join(self.dict_dir, f'{dict_name}.txt')
            
            # 读取现有词条
            existing_terms = set()
            if os.path.exists(dict_path):
                with open(dict_path, 'r', encoding='utf-8') as f:
                    existing_terms = set(line.strip().split('\t')[0] for line in f)
                    
            # 合并新词条，添加词性和频率信息
            all_terms = existing_terms.union(terms)
            
            # 保存所有词条，包含词性和频率信息
            with open(dict_path, 'w', encoding='utf-8') as f:
                for term in sorted(all_terms):
                    # 默认词性为n（名词），默认频率为1000
                    f.write(f"{term}\tn\t1000\n")
                    
            logger.info(f"保存了 {len(all_terms)} 个词条到 {dict_name}")
            
        except Exception as e:
            logger.error(f"保存词典失败: {str(e)}")
            
    def merge_dicts(self):
        """合并所有词典文件，优化处理不同来源的词条"""
        try:
            all_terms = {}
            baidu_terms = {}  # 专门存储百度百科词条
            
            # 遍历词典目录
            for file_name in os.listdir(self.dict_dir):
                if not file_name.endswith('.txt'):
                    continue
                    
                dict_path = os.path.join(self.dict_dir, file_name)
                
                # 处理百度百科词条（仅针对中文）
                if file_name.startswith('baidu_zh_'):
                    with open(dict_path, 'r', encoding='utf-8') as f:
                        for line in f:
                            parts = line.strip().split('\t')
                            term = parts[0]
                            pos = parts[1] if len(parts) > 1 else 'n'
                            freq = int(parts[2]) if len(parts) > 2 else 1000
                            baidu_terms[term] = (pos, freq)
                    continue
                
                # 处理维基百科词条
                lang_match = re.search(r'wiki_(\w+)_', file_name)
                if not lang_match:
                    continue
                    
                lang = lang_match.group(1)
                with open(dict_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        parts = line.strip().split('\t')
                        term = parts[0]
                        pos = parts[1] if len(parts) > 1 else 'n'
                        freq = int(parts[2]) if len(parts) > 2 else 1000
                        
                        # 按语言分组
                        if lang not in all_terms:
                            all_terms[lang] = {}
                        all_terms[lang][term] = (pos, freq)
            
            # 保存合并后的词典
            for lang, terms in all_terms.items():
                merged_path = os.path.join(self.dict_dir, f'merged_{lang}.txt')
                with open(merged_path, 'w', encoding='utf-8') as f:
                    for term, (pos, freq) in sorted(terms.items()):
                        f.write(f"{term}\t{pos}\t{freq}\n")
            
            # 特殊处理：保存百度百科词条（仅中文）
            if baidu_terms:
                baidu_path = os.path.join(self.dict_dir, 'baidu_merged_zh.txt')
                with open(baidu_path, 'w', encoding='utf-8') as f:
                    for term, (pos, freq) in sorted(baidu_terms.items()):
                        f.write(f"{term}\t{pos}\t{freq}\n")
                        
            logger.info("词典合并完成，维基词条和百度词条已分别保存")
            
        except Exception as e:
            logger.error(f"合并词典失败: {str(e)}") 