import os
import json
import time
from pathlib import Path
from initialization import app
from utils.attachment_handler.image_handler import normalize_user_id
from typing import Dict, Any, List

class TextHandler:
    @staticmethod
    def save_text_locally(text_content, file_name, user_id, encoding='utf-8'):
        """
        将文本内容保存到本地文件
        
        Args:
            text_content (str): 文本内容
            file_name (str): 原始文件名
            user_id: 用户ID（邮箱或数字ID）
            encoding (str): 文本编码，默认utf-8
            
        Returns:
            dict: 包含文件信息的字典
        """
        try:
            # 标准化用户ID
            normalized_user_id = normalize_user_id(user_id)
            
            # 创建用户专属的文本文件存储目录
            base_dir = Path(app.config['UPLOAD_FOLDER']) / normalized_user_id / 'text_files'
            base_dir.mkdir(parents=True, exist_ok=True)
            
            # 生成唯一文件名
            timestamp = int(time.time() * 1000)
            unique_id = f"{timestamp}"
            
            # 保存文本内容
            file_path = base_dir / f"{unique_id}.txt"
            with open(str(file_path), 'w', encoding=encoding) as f:
                f.write(text_content)
            
            # 保存元数据
            metadata = {
                'file_name': file_name,
                'content_id': unique_id,
                'created_at': timestamp,
                'encoding': encoding,
                'size': len(text_content.encode(encoding)),
                'line_count': len(text_content.splitlines()),
                'file_path': str(file_path)
            }
            
            metadata_path = base_dir / f"{unique_id}_meta.json"
            with open(str(metadata_path), 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            
            return metadata
            
        except Exception as e:
            raise Exception(f"保存文本文件失败: {str(e)}")

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

    @staticmethod
    def delete_text_file(content_id, user_id):
        """
        删除指定的文本文件及其元数据
        
        Args:
            content_id (str): 内容唯一标识符
            user_id: 用户ID
            
        Returns:
            bool: 是否删除成功
        """
        try:
            normalized_user_id = normalize_user_id(user_id)
            base_dir = Path(app.config['UPLOAD_FOLDER']) / normalized_user_id / 'text_files'
            
            # 删除文本文件
            file_path = base_dir / f"{content_id}.txt"
            if file_path.exists():
                os.remove(str(file_path))
            
            # 删除元数据文件
            metadata_path = base_dir / f"{content_id}_meta.json"
            if metadata_path.exists():
                os.remove(str(metadata_path))
            
            return True
            
        except Exception as e:
            print(f"删除文本文件失败: {str(e)}")
            return False

    @staticmethod
    def get_text_by_lines(content_id: str, user_id: str, index_line: int, up_line_count: int = 5, down_line_count: int = 5) -> Dict[str, Any]:
        """
        获取指定行及其上下文内容
        
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
                'error': str (可选)
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
            
            return {
                'success': True,
                'content': lines[index_line - 1],
                'context_before': lines[start:index_line - 1],
                'context_after': lines[index_line:end],
                'line_number': index_line,
                'total_lines': total_lines
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
            
    @staticmethod
    def get_text_by_multiple_lines(content_id: str, user_id: str, line_numbers: List[int], up_line_count: int = 5, down_line_count: int = 5) -> Dict[str, Any]:
        """
        获取多个指定行及其上下文，支持上下文合并
        
        Args:
            content_id (str): 内容唯一标识符
            user_id (str): 用户ID
            line_numbers (List[int]): 目标行号列表
            up_line_count (int): 向上获取的行数
            down_line_count (int): 向下获取的行数
            
        Returns:
            Dict[str, Any]: {
                'success': bool,
                'contexts': List[Dict],  # 合并后的上下文段落列表
                'total_lines': int,
                'error': str (可选)
            }
            
            其中每个 context 包含：
            {
                'content': str,          # 目标行内容
                'context_before': List[str], # 上文
                'context_after': List[str],  # 下文
                'line_number': int,      # 目标行号
                'total_lines': int,      # 总行数
                'segment_start': int,    # 当前段落起始行号
                'segment_end': int,      # 当前段落结束行号
                'target_lines': List[int] # 当前段落包含的所有目标行号
            }
        """
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
            
            # 对行号排序并初始化结果
            sorted_lines = sorted(line_numbers)
            merged_contexts = []
            current_context = None
            
            for line_num in sorted_lines:
                # 计算当前行的上下文范围
                start = max(1, line_num - up_line_count)
                end = min(total_lines, line_num + down_line_count)
                
                # 检查是否需要合并到当前上下文
                if current_context and start <= current_context['segment_end'] + 1:
                    # 扩展当前段落
                    current_context['segment_end'] = max(current_context['segment_end'], end)
                    current_context['target_lines'].append(line_num)
                    # 更新上下文内容
                    current_context['context_after'] = lines[current_context['line_number']:current_context['segment_end']]
                else:
                    # 保存当前上下文（如果存在）
                    if current_context:
                        merged_contexts.append(current_context)
                    
                    # 创建新的上下文段落
                    current_context = {
                        'content': lines[line_num - 1],
                        'context_before': lines[start - 1:line_num - 1],
                        'context_after': lines[line_num:end],
                        'line_number': line_num,
                        'total_lines': total_lines,
                        'segment_start': start,
                        'segment_end': end,
                        'target_lines': [line_num]
                    }
            
            # 添加最后一个上下文
            if current_context:
                merged_contexts.append(current_context)
            
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
