import re
from typing import Optional, Union

def detect_encoding(text: Union[str, bytes]) -> Optional[str]:
    """
    检测文本的实际编码
    
    Args:
        text: 文本内容或字节内容
        
    Returns:
        Optional[str]: 检测到的编码，如果无法确定则返回None
    """
    try:
        import chardet
        # 如果text是字符串，先转为bytes
        if isinstance(text, str):
            # 尝试使用不同编码将其转为bytes
            for enc in ['utf-8', 'gbk', 'gb2312', 'ascii', 'latin1']:
                try:
                    text_bytes = text.encode(enc)
                    break
                except UnicodeEncodeError:
                    continue
        else:
            text_bytes = text
            
        # 检测编码
        result = chardet.detect(text_bytes)
        if result['confidence'] > 0.7:
            return result['encoding']
        return None
    except Exception as e:
        print(f"编码检测失败: {str(e)}")
        return None

def fix_encoding(text: Union[str, bytes], declared_encoding: str = 'utf-8', 
               detected_encoding: Optional[str] = None) -> str:
    """
    修复文本编码问题
    
    Args:
        text: 文本内容或字节内容
        declared_encoding: 声明的编码
        detected_encoding: 检测到的编码
        
    Returns:
        str: 修复后的文本
    """
    try:
        # 如果text已经是字符串，先尝试将其转为bytes
        if isinstance(text, str):
            try:
                # 用声明的编码转换回bytes
                text_bytes = text.encode(declared_encoding)
            except UnicodeEncodeError:
                # 如果失败，尝试用latin1（这通常能保留所有字节）
                text_bytes = text.encode('latin1')
        else:
            text_bytes = text
            
        # 如果检测到了编码，使用它来解码
        if detected_encoding:
            return text_bytes.decode(detected_encoding, errors='replace')
        
        # 尝试常见编码
        for enc in ['utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'latin1']:
            try:
                decoded = text_bytes.decode(enc)
                if '�' not in decoded:  # 没有替换字符
                    return decoded
            except UnicodeDecodeError:
                continue
                
        # 最后尝试使用'replace'错误处理来避免失败
        return text_bytes.decode(declared_encoding, errors='replace')
    except Exception as e:
        print(f"编码修复失败: {str(e)}")
        # 返回原文本，添加警告
        if isinstance(text, str):
            return text + "\n[警告：文本编码存在问题，可能导致显示异常]"
        else:
            return text_bytes.decode('utf-8', errors='replace') + "\n[警告：文本编码存在问题，可能导致显示异常]"

def is_chinese_corrupted(text: str) -> bool:
    """
    检测中文是否已经损坏（显示为乱码）
    
    Args:
        text: 文本内容
        
    Returns:
        bool: 是否包含中文乱码
    """
    # 检测常见的乱码模式
    # 例如：æ¯å¾®è½¯
    corrupted_pattern = r'[æ¯å¾®è½¯é¡¹ç®äºº]+'
    return bool(re.search(corrupted_pattern, text))

def recover_corrupted_chinese(text: str) -> str:
    """
    尝试恢复损坏的中文
    
    Args:
        text: 带有中文乱码的文本
        
    Returns:
        str: 尝试恢复后的文本
    """
    try:
        # 这种修复方法假设文本是从UTF-8编码通过latin1解码导致乱码
        # 尝试将其重新编码为latin1然后按UTF-8解码
        return text.encode('latin1').decode('utf-8', errors='replace')
    except Exception:
        # 如果失败，返回原文
        return text 