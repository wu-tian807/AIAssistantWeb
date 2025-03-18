import os
import json
import time
from pathlib import Path
from typing import Dict, Any, List, Tuple
import numpy as np
from initialization import app, oaipro_client

class TextEmbedding:
    """文本嵌入处理类，用于生成和管理文本的嵌入向量"""
    
    # 配置常量
    DEFAULT_CHUNK_SIZE = 1000  # 默认分块大小（字符数）
    MIN_CHUNK_SIZE = 300       # 最小分块大小
    MAX_CHUNK_SIZE = 4000      # 最大分块大小
    OVERLAP_RATIO = 0.1        # 分块重叠比例
    EMBEDDING_MODEL = "text-embedding-3-large"  # 使用的嵌入模型
    
    def __init__(self):
        self.model = self.EMBEDDING_MODEL
        self.client = oaipro_client
    
    async def process_text(self, text: str, file_id: str, base_path: str, 
                         text_type: str = "普通文章", 
                         line_length: int = 100,
                         creativity_score: float = 0.5) -> Dict[str, Any]:
        """
        处理文本，分块并生成嵌入向量
        
        Args:
            text: 文本内容
            file_id: 文件ID
            base_path: 基础路径
            text_type: 文本类型
            line_length: 换行长度
            creativity_score: 创意性评分
            
        Returns:
            Dict: 处理结果
        """
        try:
            # 获取文本行
            lines = text.splitlines()
            total_lines = len(lines)
            
            # 根据专业度动态计算分块大小
            chunk_size = self._calculate_chunk_size(creativity_score, len(text))
            
            # 分割文本
            chunks, line_ranges = self._split_text(text, lines, chunk_size)
            
            # 获取每个分块的嵌入向量
            embeddings = await self._get_embeddings(chunks)
            
            # 保存嵌入向量和相关信息
            result = self._save_embeddings(
                file_id=file_id,
                base_path=base_path,
                chunks=chunks,
                embeddings=embeddings,
                line_ranges=line_ranges,
                text_type=text_type,
                line_length=line_length,
                creativity_score=creativity_score,
                total_lines=total_lines
            )
            
            return {
                'success': True,
                'chunk_count': len(chunks),
                'model': self.model,
                'text_type': text_type,
                'line_length': line_length,
                'creativity_score': creativity_score,
                'embedding_file': result.get('embedding_file')
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _calculate_chunk_size(self, creativity_score: float, text_length: int) -> int:
        """
        根据创意性评分动态计算分块大小
        
        创意性较低（专业文本）：较小的分块大小，便于精确搜索
        创意性较高（文学文本）：较大的分块大小，保持语义连贯性
        
        Args:
            creativity_score: 0.0-1.0之间的创意性评分
            text_length: 文本总长度
            
        Returns:
            int: 分块大小（字符数）
        """
        # 根据创意性动态调整分块大小
        # 专业性文本(接近0)使用较小块，创意性文本(接近1)使用较大块
        adjustment_factor = 0.3 + (0.7 * creativity_score)
        
        # 基础块大小在最小和最大之间
        base_size = self.MIN_CHUNK_SIZE + (self.MAX_CHUNK_SIZE - self.MIN_CHUNK_SIZE) * adjustment_factor
        
        # 根据文本总长度微调
        if text_length < 10000:  # 短文本
            base_size *= 0.7
        elif text_length > 50000:  # 长文本
            base_size *= 1.2
            
        # 确保在允许范围内
        return max(self.MIN_CHUNK_SIZE, min(int(base_size), self.MAX_CHUNK_SIZE))
    
    def _split_text(self, text: str, lines: List[str], chunk_size: int) -> Tuple[List[str], List[Dict[str, int]]]:
        """
        将文本分割成块，保持语义和行号完整性
        
        Args:
            text: 完整文本
            lines: 文本按行分割
            chunk_size: 分块大小（字符数）
            
        Returns:
            Tuple[List[str], List[Dict[str, int]]]: 分块列表和每块对应的行号范围
        """
        chunks = []
        line_ranges = []
        
        # 计算重叠大小（字符数）
        overlap_size = int(chunk_size * self.OVERLAP_RATIO)
        
        # 当前处理位置
        current_pos = 0
        current_line = 0
        text_length = len(text)
        
        while current_pos < text_length:
            # 计算当前块的结束位置
            end_pos = min(current_pos + chunk_size, text_length)
            
            # 如果不是最后一块，尝试找到自然分割点（段落、句子等）
            if end_pos < text_length:
                # 在重叠区域内寻找段落结束
                search_end = min(end_pos + overlap_size, text_length)
                natural_end = self._find_natural_break(text, end_pos, search_end)
                end_pos = natural_end if natural_end > end_pos else end_pos
            
            # 提取当前块文本
            chunk_text = text[current_pos:end_pos]
            
            # 确定当前块覆盖的行范围
            start_line, end_line, current_line = self._determine_line_range(
                text, lines, current_pos, end_pos, current_line)
            
            chunks.append(chunk_text)
            line_ranges.append({
                'start_line': start_line + 1,  # 转为1-based索引
                'end_line': end_line + 1
            })
            
            # 更新下一个块的起始位置，考虑重叠
            current_pos = max(current_pos + 1, end_pos - overlap_size)
        
        return chunks, line_ranges
    
    def _find_natural_break(self, text: str, start_pos: int, end_pos: int) -> int:
        """
        在指定范围内找到自然分割点（优先级：段落>句子>单词）
        
        Args:
            text: 文本内容
            start_pos: 起始位置
            end_pos: 结束位置
            
        Returns:
            int: 自然分割点位置
        """
        # 搜索范围内的文本
        search_text = text[start_pos:end_pos]
        
        # 尝试按段落分割（双换行）
        paragraph_breaks = [m.start() + start_pos for m in re.finditer(r'\n\s*\n', search_text)]
        if paragraph_breaks:
            return paragraph_breaks[0] + 2  # +2 跳过换行符
        
        # 尝试按句子分割
        sentence_breaks = [m.start() + start_pos for m in re.finditer(r'[.!?。！？]\s', search_text)]
        if sentence_breaks:
            return sentence_breaks[0] + 1
        
        # 尝试按逗号分割
        comma_breaks = [m.start() + start_pos for m in re.finditer(r'[,，、]\s', search_text)]
        if comma_breaks:
            return comma_breaks[0] + 1
        
        # 尝试在单词边界分割（针对英文）
        word_breaks = [m.start() + start_pos for m in re.finditer(r'\s', search_text)]
        if word_breaks:
            return word_breaks[0]
        
        # 找不到合适的分割点，返回原始结束位置
        return end_pos
    
    def _determine_line_range(self, text: str, lines: List[str], start_pos: int, end_pos: int, current_line: int) -> Tuple[int, int, int]:
        """
        确定文本块对应的行号范围
        
        Args:
            text: 完整文本
            lines: 文本按行分割
            start_pos: 块起始位置（字符索引）
            end_pos: 块结束位置（字符索引）
            current_line: 当前处理到的行号
            
        Returns:
            Tuple[int, int, int]: 起始行号，结束行号，下次处理的行号
        """
        start_line = current_line
        line_pos = 0
        
        # 找到起始行
        while start_line < len(lines):
            line_length = len(lines[start_line]) + 1  # +1 for newline
            if line_pos + line_length > start_pos:
                break
            line_pos += line_length
            start_line += 1
        
        # 找到结束行
        end_line = start_line
        while end_line < len(lines) and line_pos < end_pos:
            line_length = len(lines[end_line]) + 1
            line_pos += line_length
            if line_pos >= end_pos:
                break
            end_line += 1
        
        return start_line, min(end_line, len(lines) - 1), end_line
    
    async def _get_embeddings(self, chunks: List[str]) -> List[List[float]]:
        """
        获取文本块的嵌入向量
        
        Args:
            chunks: 文本块列表
            
        Returns:
            List[List[float]]: 嵌入向量列表
        """
        embeddings = []
        
        for chunk in chunks:
            try:
                response = self.client.embeddings.create(
                    model=self.model,
                    input=chunk
                )
                embedding = response.data[0].embedding
                embeddings.append(embedding)
            except Exception as e:
                print(f"获取嵌入向量失败: {str(e)}")
                # 使用零向量作为占位符
                embeddings.append([0.0] * 3072)  # text-embedding-3-large 的维度是3072
        
        return embeddings
    
    def _save_embeddings(self, file_id: str, base_path: str, chunks: List[str], 
                       embeddings: List[List[float]], line_ranges: List[Dict[str, int]],
                       text_type: str, line_length: int, creativity_score: float,
                       total_lines: int) -> Dict[str, Any]:
        """
        保存嵌入向量和相关信息
        
        Args:
            file_id: 文件ID
            base_path: 基础路径
            chunks: 文本块列表
            embeddings: 嵌入向量列表
            line_ranges: 行号范围列表
            text_type: 文本类型
            line_length: 换行长度
            creativity_score: 创意性评分
            total_lines: 总行数
            
        Returns:
            Dict: 保存结果
        """
        # 创建embedding目录
        embedding_dir = Path(base_path) / 'embeddings'
        embedding_dir.mkdir(parents=True, exist_ok=True)
        
        # 创建文件ID特定目录
        file_embed_dir = embedding_dir / file_id
        file_embed_dir.mkdir(exist_ok=True)
        
        # 保存嵌入信息
        embedding_data = {
            'file_id': file_id,
            'created_at': int(time.time() * 1000),
            'model': self.model,
            'text_type': text_type,
            'line_length': line_length,
            'creativity_score': creativity_score,
            'total_lines': total_lines,
            'chunks': [
                {
                    'text': chunk,
                    'embedding': embedding,
                    'start_line': line_range['start_line'],
                    'end_line': line_range['end_line']
                }
                for chunk, embedding, line_range in zip(chunks, embeddings, line_ranges)
            ]
        }
        
        # 保存到文件
        embedding_file = file_embed_dir / 'embeddings.json'
        with open(str(embedding_file), 'w', encoding='utf-8') as f:
            json.dump(embedding_data, f, ensure_ascii=False)
        
        return {
            'success': True,
            'embedding_file': str(embedding_file)
        }
    
    def delete_embeddings(self, base_path: str, file_id: str) -> bool:
        """
        删除文件的嵌入向量
        
        Args:
            base_path: 基础路径
            file_id: 文件ID
            
        Returns:
            bool: 是否删除成功
        """
        try:
            embedding_dir = Path(base_path) / 'embeddings' / file_id
            if embedding_dir.exists():
                # 删除目录及其内容
                for item in embedding_dir.glob('*'):
                    item.unlink()
                embedding_dir.rmdir()
            return True
        except Exception as e:
            print(f"删除嵌入向量失败: {str(e)}")
            return False
    
    async def search_text(self, query: str, base_path: str, file_id: str, 
                        top_k: int = 3) -> Dict[str, Any]:
        """
        使用嵌入向量搜索相关文本块
        
        Args:
            query: 查询文本
            base_path: 基础路径
            file_id: 文件ID
            top_k: 返回的最相关结果数量
            
        Returns:
            Dict: 搜索结果
        """
        try:
            # 生成查询的嵌入向量
            query_response = self.client.embeddings.create(
                model=self.model,
                input=query
            )
            query_embedding = query_response.data[0].embedding
            
            # 加载文件嵌入向量
            embedding_file = Path(base_path) / 'embeddings' / file_id / 'embeddings.json'
            if not embedding_file.exists():
                return {
                    'success': False,
                    'error': f'找不到嵌入文件: {embedding_file}'
                }
            
            with open(str(embedding_file), 'r', encoding='utf-8') as f:
                embedding_data = json.load(f)
            
            # 计算相似度并排序
            results = []
            for chunk in embedding_data['chunks']:
                chunk_embedding = chunk['embedding']
                similarity = self._calculate_similarity(query_embedding, chunk_embedding)
                
                results.append({
                    'text': chunk['text'],
                    'start_line': chunk['start_line'],
                    'end_line': chunk['end_line'],
                    'similarity': similarity
                })
            
            # 按相似度降序排序
            results.sort(key=lambda x: x['similarity'], reverse=True)
            
            return {
                'success': True,
                'results': results[:top_k],
                'text_type': embedding_data.get('text_type'),
                'line_length': embedding_data.get('line_length'),
                'creativity_score': embedding_data.get('creativity_score')
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _calculate_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        计算两个向量的余弦相似度
        
        Args:
            vec1: 第一个向量
            vec2: 第二个向量
            
        Returns:
            float: 余弦相似度
        """
        vec1_array = np.array(vec1)
        vec2_array = np.array(vec2)
        
        dot_product = np.dot(vec1_array, vec2_array)
        norm1 = np.linalg.norm(vec1_array)
        norm2 = np.linalg.norm(vec2_array)
        
        # 避免除以零
        if norm1 == 0 or norm2 == 0:
            return 0.0
            
        return dot_product / (norm1 * norm2)

# 导入正则表达式模块
import re
