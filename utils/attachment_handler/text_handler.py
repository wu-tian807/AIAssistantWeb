import os
import json
import time
from pathlib import Path
from initialization import app
from utils.attachment_handler.image_handler import normalize_user_id
#from utils.text_attachment.embeddings import TextEmbedding
from typing import Dict, Any, List

class TextHandler:
    # @staticmethod
    # async def save_text_locally(text_content, file_name, user_id, encoding='utf-8'):
    #     """
    #     将文本内容保存到本地文件，并生成embeddings
        
    #     Args:
    #         text_content (str): 文本内容
    #         file_name (str): 原始文件名
    #         user_id: 用户ID（邮箱或数字ID）
    #         encoding (str): 文本编码，默认utf-8
            
    #     Returns:
    #         dict: 包含文件信息的字典
    #     """
    #     try:
    #         # 标准化用户ID
    #         normalized_user_id = normalize_user_id(user_id)
            
    #         # 创建用户专属的文本文件存储目录
    #         base_dir = Path(app.config['UPLOAD_FOLDER']) / normalized_user_id
    #         text_dir = base_dir / 'text_files'
    #         text_dir.mkdir(parents=True, exist_ok=True)
            
    #         # 生成唯一文件名
    #         timestamp = int(time.time() * 1000)
    #         unique_id = f"{timestamp}"
            
    #         # 保存文本内容
    #         file_path = text_dir / f"{unique_id}.txt"
    #         with open(str(file_path), 'w', encoding=encoding) as f:
    #             f.write(text_content)
            
    #         # 保存元数据
    #         metadata = {
    #             'file_name': file_name,
    #             'content_id': unique_id,
    #             'created_at': timestamp,
    #             'encoding': encoding,
    #             'size': len(text_content.encode(encoding)),
    #             'line_count': len(text_content.splitlines()),
    #             'file_path': str(file_path)
    #         }
            
    #         metadata_path = text_dir / f"{unique_id}_meta.json"
    #         with open(str(metadata_path), 'w', encoding='utf-8') as f:
    #             json.dump(metadata, f, ensure_ascii=False, indent=2)
            
    #         # 生成和保存embeddings
    #         try:
    #             embedding_processor = TextEmbedding()
    #             embedding_result = await embedding_processor.process_text(
    #                 text=text_content,
    #                 file_id=unique_id,
    #                 base_path=str(base_dir)
    #             )
    #             metadata['embedding'] = embedding_result
    #         except Exception as e:
    #             print(f"生成embeddings失败: {str(e)}")
    #             metadata['embedding'] = {'success': False, 'error': str(e)}
            
    #         return metadata
            
    #     except Exception as e:
    #         raise Exception(f"保存文本文件失败: {str(e)}")

    @staticmethod
    def get_text_content(content_id, user_id):
        """
        根据内容ID获取文本内容
        
        Args:
            content_id (str): 内容唯一标识符
            user_id: 用户ID
            
        Returns:
            tuple: (文本内容, 元数据)
        """
        try:
            # 构建文件路径
            normalized_user_id = normalize_user_id(user_id)
            base_dir = Path(app.config['UPLOAD_FOLDER']) / normalized_user_id / 'text_files'
            
            # 读取元数据
            metadata_path = base_dir / f"{content_id}_meta.json"
            if not metadata_path.exists():
                raise FileNotFoundError(f"找不到元数据文件: {metadata_path}")
            
            with open(str(metadata_path), 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            # 读取文本内容
            file_path = base_dir / f"{content_id}.txt"
            if not file_path.exists():
                raise FileNotFoundError(f"找不到文本文件: {file_path}")
            
            with open(str(file_path), 'r', encoding=metadata.get('encoding', 'utf-8')) as f:
                content = f.read()
            
            return content, metadata
            
        except FileNotFoundError:
            raise
        except json.JSONDecodeError as e:
            raise json.JSONDecodeError(f"元数据解析错误: {str(e)}", e.doc, e.pos)
        except Exception as e:
            raise Exception(f"获取文本内容失败: {str(e)}")

    # @staticmethod
    # def delete_text_file(content_id, user_id):
    #     """
    #     删除指定的文本文件及其元数据
        
    #     Args:
    #         content_id (str): 内容唯一标识符
    #         user_id: 用户ID
            
    #     Returns:
    #         bool: 是否删除成功
    #     """
    #     try:
    #         normalized_user_id = normalize_user_id(user_id)
    #         base_dir = Path(app.config['UPLOAD_FOLDER']) / normalized_user_id
    #         text_dir = base_dir / 'text_files'
            
    #         # 删除文本文件
    #         file_path = text_dir / f"{content_id}.txt"
    #         if file_path.exists():
    #             os.remove(str(file_path))
            
    #         # 删除元数据文件
    #         metadata_path = text_dir / f"{content_id}_meta.json"
    #         if metadata_path.exists():
    #             os.remove(str(metadata_path))
            
    #         # 删除embeddings
    #         embedding_processor = TextEmbedding()
    #         embedding_processor.delete_embeddings(str(base_dir), content_id)
            
    #         return True
            
    #     except Exception as e:
    #         print(f"删除文本文件失败: {str(e)}")
    #         return False

    @staticmethod
    def get_text_by_lines(content_id: str, user_id: str, index_line: int, up_line_count: int = 5, down_line_count: int = 5) -> Dict[str, Any]:
        """
        获取指定行及其上下文内容，自动处理文件边界
        
        Args:
            content_id (str): 内容唯一标识符
            user_id (str): 用户ID
            index_line (int): 目标行号（1-based）
            up_line_count (int): 向上获取的行数
            down_line_count (int): 向下获取的行数
            
        Returns:
            Dict[str, Any]: {
                'success': bool,
                'content': str,
                'context_before': List[str],
                'context_after': List[str],
                'line_number': int,
                'total_lines': int,
                'error': str (可选),
                'reached_start': bool,  # 是否到达文件开始
                'reached_end': bool     # 是否到达文件结束
            }
        """
        try:
            # 获取完整内容
            content, metadata = TextHandler.get_text_content(content_id, user_id)
            
            # 将内容分割成行
            lines = content.splitlines()
            total_lines = len(lines)
            
            # 验证行号
            if not (1 <= index_line <= total_lines):
                return {
                    'success': False,
                    'error': f'行号 {index_line} 超出范围 (1-{total_lines})'
                }
            
            # 计算实际范围（考虑文件边界）
            start = max(0, index_line - 1 - up_line_count)
            end = min(total_lines, index_line - 1 + down_line_count + 1)
            
            # 检查是否到达文件边界
            reached_start = start == 0
            reached_end = end == total_lines
            
            return {
                'success': True,
                'content': lines[index_line - 1],
                'context_before': lines[start:index_line - 1],
                'context_after': lines[index_line:end],
                'line_number': index_line,
                'total_lines': total_lines,
                'reached_start': reached_start,
                'reached_end': reached_end
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
            
    @staticmethod
    def merge_context_segments(segments: List[Dict[str, Any]], lines: List[str]) -> List[Dict[str, Any]]:
        """
        合并重叠的上下文段落
        
        Args:
            segments: List[Dict[str, Any]]  # 包含每个段落的信息，每个段落包含：
                {
                    'line_number': int,      # 目标行号
                    'segment_start': int,    # 段落起始行号
                    'segment_end': int,      # 段落结束行号
                    'target_lines': List[int] # 当前段落包含的所有目标行号
                }
            lines: List[str]  # 原始文本内容的所有行
            
        Returns:
            List[Dict[str, Any]]  # 合并后的上下文段落列表，每个段落包含：
            {
                'content': str,          # 目标行内容
                'context_before': List[str], # 上文
                'context_after': List[str],  # 下文
                'line_number': int,      # 目标行号
                'segment_start': int,    # 当前段落起始行号
                'segment_end': int,      # 当前段落结束行号
                'target_lines': List[int] # 当前段落包含的所有目标行号
            }
        """
        if not segments:
            return []
            
        # 按起始位置排序
        sorted_segments = sorted(segments, key=lambda x: x['segment_start'])
        merged_segments = []
        current_segment = sorted_segments[0].copy()
        
        for next_segment in sorted_segments[1:]:
            # 检查是否需要合并（段落有重叠或相邻）
            if next_segment['segment_start'] <= current_segment['segment_end'] + 1:
                # 扩展当前段落
                current_segment['segment_end'] = max(current_segment['segment_end'], 
                                                   next_segment['segment_end'])
                current_segment['target_lines'].extend(next_segment['target_lines'])
                current_segment['target_lines'].sort()  # 保持目标行有序
            else:
                # 处理当前段落的内容
                merged_segments.append({
                    'content': lines[current_segment['line_number'] - 1],
                    'context_before': lines[current_segment['segment_start'] - 1:
                                          current_segment['line_number'] - 1],
                    'context_after': lines[current_segment['line_number']:
                                         current_segment['segment_end']],
                    'line_number': current_segment['line_number'],
                    'segment_start': current_segment['segment_start'],
                    'segment_end': current_segment['segment_end'],
                    'target_lines': current_segment['target_lines']
                })
                current_segment = next_segment.copy()
        
        # 添加最后一个段落
        merged_segments.append({
            'content': lines[current_segment['line_number'] - 1],
            'context_before': lines[current_segment['segment_start'] - 1:
                                  current_segment['line_number'] - 1],
            'context_after': lines[current_segment['line_number']:
                                 current_segment['segment_end']],
            'line_number': current_segment['line_number'],
            'segment_start': current_segment['segment_start'],
            'segment_end': current_segment['segment_end'],
            'target_lines': current_segment['target_lines']
        })
        
        return merged_segments

    @staticmethod
    def get_text_by_multiple_lines(content_id: str, user_id: str, line_numbers: List[int], up_line_count: int = 5, down_line_count: int = 5) -> Dict[str, Any]:
        """获取多个指定行及其上下文，支持上下文合并"""
        try:
            # 获取完整内容
            content, metadata = TextHandler.get_text_content(content_id, user_id)
            lines = content.splitlines()
            total_lines = len(lines)
            
            # 验证所有行号
            for line_num in line_numbers:
                if not (1 <= line_num <= total_lines):
                    return {
                        'success': False,
                        'error': f'行号 {line_num} 超出范围 (1-{total_lines})'
                    }
            
            # 构造初始段落信息
            segments = []
            for line_num in sorted(line_numbers):
                # 计算当前行的上下文范围
                start = max(1, line_num - up_line_count)
                end = min(total_lines, line_num + down_line_count)
                
                segments.append({
                    'line_number': line_num,
                    'segment_start': start,
                    'segment_end': end,
                    'target_lines': [line_num]
                })
            
            # 合并重叠的段落
            merged_contexts = TextHandler.merge_context_segments(segments, lines)
            
            return {
                'success': True,
                'contexts': merged_contexts,
                'total_lines': total_lines
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def search_text_by_keyword(content_id: str, user_id: str, keyword: str, 
                             max_matches: int = 10, up_line_count: int = 5, 
                             down_line_count: int = 5) -> Dict[str, Any]:
        """
        搜索单个关键词并返回匹配结果及其上下文
        
        Args:
            content_id (str): 内容唯一标识符
            user_id (str): 用户ID
            keyword (str): 搜索关键词
            max_matches (int): 最大匹配数量
            up_line_count (int): 向上获取的行数
            down_line_count (int): 向下获取的行数
            
        Returns:
            Dict[str, Any]: {
                'success': bool,
                'matches': List[Dict],  # 匹配结果列表
                'total_matches': int,   # 总匹配数
                'error': str (可选)
            }
        """
        try:
            # 获取完整内容
            content, metadata = TextHandler.get_text_content(content_id, user_id)
            lines = content.splitlines()
            total_lines = len(lines)
            
            # 查找所有匹配行
            matches = []
            for i, line in enumerate(lines, 1):
                if keyword in line:
                    matches.append(i)
                    if len(matches) >= max_matches:
                        break
            
            if not matches:
                return {
                    'success': True,
                    'matches': [],
                    'total_matches': 0
                }
            
            # 获取匹配行的上下文
            return TextHandler.get_text_by_multiple_lines(
                content_id, 
                user_id, 
                matches, 
                up_line_count, 
                down_line_count
            )
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def search_text_by_keywords(content_id: str, user_id: str, 
                              keyword_configs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        搜索多个关键词并返回匹配结果及其上下文，支持每个关键词独立配置
        
        Args:
            content_id (str): 内容唯一标识符
            user_id (str): 用户ID
            keyword_configs: List[Dict[str, Any]]  # 关键词配置列表，每项包含：
                {
                    'keyword': str,        # 关键词
                    'max_matches': int,    # 最大匹配数量
                    'up_line_count': int,  # 向上获取的行数
                    'down_line_count': int # 向下获取的行数
                }
            
        Returns:
            Dict[str, Any]: {
                'success': bool,
                'matches': List[Dict],  # 合并后的匹配结果
                'total_matches': int,   # 总匹配数
                'error': str (可选)
            }
        """
        try:
            # 获取完整内容
            content, metadata = TextHandler.get_text_content(content_id, user_id)
            lines = content.splitlines()
            total_lines = len(lines)
            
            # 存储所有匹配的段落信息
            all_segments = []
            
            # 处理每个关键词
            for config in keyword_configs:
                keyword = config['keyword']
                max_matches = config.get('max_matches', 10)
                up_lines = config.get('up_line_count', 5)
                down_lines = config.get('down_line_count', 5)
                
                # 查找当前关键词的匹配行
                matches = []
                for i, line in enumerate(lines, 1):
                    if keyword in line:
                        matches.append(i)
                        if len(matches) >= max_matches:
                            break
                
                # 为每个匹配创建段落信息
                for line_num in matches:
                    start = max(1, line_num - up_lines)
                    end = min(total_lines, line_num + down_lines)
                    all_segments.append({
                        'line_number': line_num,
                        'segment_start': start,
                        'segment_end': end,
                        'target_lines': [line_num]
                    })
            
            if not all_segments:
                return {
                    'success': True,
                    'matches': [],
                    'total_matches': 0
                }
            
            # 合并重叠的段落
            merged_contexts = TextHandler.merge_context_segments(all_segments, lines)
            
            return {
                'success': True,
                'contexts': merged_contexts,
                'total_matches': len(all_segments)
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
