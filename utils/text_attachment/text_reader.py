import os
import json
from typing import List, Tuple, Dict, Any, Optional
from utils.attachment_handler.text_handler import TextHandler
from initialization import deepseek_client

class ContextAnalyzer:
    """上下文分析器，用于智能分析和确定文本/代码的上下文范围"""
    
    def __init__(self, max_single_context: int = 300, initial_context: int = 20):
        self.MAX_SINGLE_CONTEXT = max_single_context  # 单侧最大上下文行数
        self.INITIAL_CONTEXT = initial_context  # 初始上下文行数
        
    def format_text(self, formatted_text: str) -> Dict[str, Any]:
        """将格式化后的文本转换为原始内容

        Args:
            formatted_text: 格式化的文本，如：
                "[已选] 98: class ExampleClass:"
                "[可见] 2: def __init__(self):"

        Returns:
            Dict[str, Any]: {
                'type': str,              # '已选' 或 '可见'
                'lines': List[Tuple[int, str]]  # [(行号, 内容), ...]
            }
        """
        # 将content转换为列表数据
        result = {
            'type': None,
            'lines': []
        }
        if not formatted_text:
            return result

        # 将formatted_text按行分割
        lines = formatted_text.split('\n')
        for line in lines:
            # 跳过空行
            if not line.strip():
                continue
                
            try:
                # 检查行格式
                if not (line.startswith('[') and ']' in line and ':' in line):
                    print(f"跳过格式不正确的行: {line}")
                    continue
                    
                # 提取标记类型
                mark_end = line.find(']')
                if mark_end == -1:
                    print(f"无法找到标记结束位置: {line}")
                    continue
                    
                mark_type = line[1:mark_end].strip()
                
                # 第一行时设置类型
                if result['type'] is None:
                    result['type'] = mark_type
                    
                # 提取行号和内容
                rest = line[mark_end + 1:].strip()
                colon_pos = rest.find(':')
                if colon_pos == -1:
                    print(f"无法找到冒号分隔符: {line}")
                    continue
                    
                line_number_str = rest[:colon_pos].strip()
                content = rest[colon_pos + 1:].strip()
                
                try:
                    line_number = int(line_number_str)
                    result['lines'].append((line_number, content))
                except ValueError:
                    print(f"无法解析行号 '{line_number_str}': {line}")
                    continue
                    
            except Exception as e:
                print(f"解析行失败: {line}, 错误: {str(e)}")
                continue
                
        return result
        
    
    def format_text_with_lines(self, content: Dict[str, Any], is_up_context: bool = True) -> str:
        """格式化已选内容，使用实际行号"""
        formatted_lines = []
        
        for context in content.get('contexts', []):
            center_line = context.get('line_number', 0)
            if is_up_context:
                # 添加上文（从中心句行号向上递减）
                for i, line in enumerate(reversed(context.get('context_before', [])), start=1):
                    line_num = center_line - i
                    formatted_lines.append(f"[已选] {line_num}: {line}")
            else:
                # 添加下文（从中心句行号向下递增）
                for i, line in enumerate(context.get('context_after', []), start=1):
                    line_num = center_line + i
                    formatted_lines.append(f"[已选] {line_num}: {line}")
            
            # 添加目标行（使用实际行号）
            if context.get('content'):
                formatted_lines.append(f"[已选] {center_line}: {context['content']}")

        
        return '\n'.join(formatted_lines)
    
    def format_visible_content(self, content: Dict[str, Any], is_up_context: bool = True) -> str:
        """格式化可见内容，使相对行号从小到大排序，中心句永远在最上面
        
        Args:
            content: 包含文本内容的字典
            is_up_context: 是否是上文
        
        Returns:
            str: 格式化后的文本，相对行号从小到大，中心句在最上
        """
        formatted_lines = []
        
        for context in content.get('contexts', []):
            if is_up_context:
                # 上文：先添加中心句（编号1），再添加上文（编号从2开始递增）
                # 添加目标行
                if context.get('content'):
                    formatted_lines.append(f"[可见] 1: {context['content']}")
                
                # 添加上文（从近到远，编号递增）
                current_number = 2
                for line in reversed(context.get('context_before', [])):
                    formatted_lines.append(f"[可见] {current_number}: {line}")
                    current_number += 1
                    
            else:
                # 下文：先添加中心句（编号1），再添加下文（编号从2开始递增）
                # 添加目标行
                if context.get('content'):
                    formatted_lines.append(f"[可见] 1: {context['content']}")
                
                # 添加下文（从近到远，编号递增）
                current_number = 2
                for line in context.get('context_after', []):
                    formatted_lines.append(f"[可见] {current_number}: {line}")
                    current_number += 1
        
        return '\n'.join(formatted_lines)
    
    def deformat_text_from_format(self, deformat_content: Dict[str, Any]) -> str:
        """将反格式化的内容转换回格式化文本
        
        Args:
            deformat_content: Dict[str, Any]: {
                'type': str,              # '已选' 或 '可见'
                'lines': List[Tuple[int, str]]  # [(行号, 内容), ...]
            }
            
        Returns:
            str: 格式化后的文本
        """
        if not deformat_content or not deformat_content.get('lines'):
            return ''
            
        content_type = deformat_content.get('type', '已选')  # 默认使用'已选'
        formatted_lines = []
        
        for line_number, content in deformat_content['lines']:
            formatted_lines.append(f"[{content_type}] {line_number}: {content}")
            
        return '\n'.join(formatted_lines)
    
    def analyze_context(self, 
                       selected_content: Dict[str, Any],
                       visible_content: Dict[str, Any],
                       is_up_context: bool = True) -> Dict[str, Any]:
        """分析上下文内容并返回建议
        
        Args:
            selected_content: 已选择的内容
            visible_content: 新增可见的内容
            is_up_context: 是否是分析上文（True表示上文，False表示下文）
            
        Returns:
            Dict[str, Any]: 包含分析建议的字典
        """
        direction = "上文" if is_up_context else "下文"
        # 构造提示让模型分析上文
        messages = [
            {
                "role": "system",
                "content": r"""你是一个代码/文本分析助手。你的任务是：
                1. 分析新获取的上文片段，判断其与中心内容的相关性
                2. 在保证上下文完整性的前提下，尽可能减少上文数量
                3. 识别并保持完整的结构，包括但不限于：
                    代码类型：
                    - 函数/方法定义：必须包含从声明到结束的完整实现（如 def/function 到 end/return/}）
                      * 发现函数开始标记时，必须找到对应的结束标记
                      * 必须包含完整的返回语句或结束标记
                      * 如果有装饰器，必须包含完整的装饰器定义
                    - 类定义：必须包含从类声明到结束的完整实现（如 class 到 end/}）
                      * 包含类的所有基本方法和属性
                      * 如果有元类或装饰器，必须完整包含
                    - 条件语句：必须包含完整的条件分支（如 if-elif-else 链）
                      * 所有条件分支必须完整
                      * 包含完整的条件表达式
                    - 循环语句：必须包含完整的循环结构（如 for/while 及其循环体）
                      * 循环的初始化、条件和迭代部分都必须完整
                      * 包含 break/continue 等控制语句
                    - 变量定义：必须包含完整的初始化语句和相关依赖
                      * 包含所有相关的导入语句
                      * 包含变量的完整初始化过程
                    
                    文本类型：
                    - 段落：必须包含从段落开始到结束的完整内容
                      * 通过空行、缩进或特殊标记判断段落边界
                    - 列表：必须包含完整的列表项
                      * 识别列表的起始和结束标记
                      * 保持列表项的层级关系
                    - 标题：必须包含相关的子标题和内容
                      * 识别标题的层级关系
                      * 包含标题下的相关内容
                    - 引用：必须包含完整的引用内容
                      * 包含引用的起始和结束标记
                      * 保持引用的格式和缩进
                    - 注释/说明：相关的说明文字必须完整保留
                      * 包含完整的注释块
                      * 保持注释的格式和对齐

                4. 分析语义结构：
                    - 确保语义完整性：一个语义单元必须是完整的
                      * 不能在语句中间截断
                      * 保持语义的连贯性
                    - 保持上/下文连贯性：相关的内容必须保持在一起
                      * 识别并保持相关代码块的完整性
                      * 维护代码块之间的依赖关系
                    - 维护逻辑关系：如果内容之间有逻辑依赖，必须一起保留
                      * 识别变量和函数的依赖关系
                      * 保持控制流程的完整性
                    - 识别语义边界：通过缩进、空行、标点、关键字等识别内容的边界
                      * 使用缩进级别判断代码块
                      * 通过关键字识别语句边界
                    - 处理交叉引用：如果内容互相引用，需要包含相关部分
                      * 识别变量和函数的引用关系
                      * 包含被引用的定义

                5. 分析语法结构：
                    - 括号匹配：所有类型的括号必须配对完整（包括 {}[]()）
                      * 使用栈结构跟踪括号匹配
                      * 确保所有括号都正确闭合
                    - 缩进层级：根据缩进判断代码块/内容层级
                      * 保持缩进的一致性
                      * 不在代码块中间截断
                    - 关键字配对：开始和结束关键字必须配对（如 if-end, try-catch）
                      * 确保所有控制结构正确闭合
                      * 包含完整的异常处理
                    - 标点完整性：不能在标点符号中间截断
                      * 确保字符串完整性
                      * 保持表达式的完整性
                    - 特殊标记：注意 \"\"\"、\'\'\'、### 等特殊标记的配对
                      * 处理多行字符串
                      * 处理特殊注释块

                6. 扩展策略：
                    - 初始扩展：先尝试小范围扩展（20行）
                      * 优先扩展到自然边界
                      * 保持代码块的完整性
                    - 渐进扩展：如果结构不完整，逐步增加范围
                      * 每次扩展增加当前范围的50%
                      * 直到找到完整结构
                    - 激进扩展：如果多次小范围扩展（≥3次）仍未找到完整结构
                      * 第一次激进：翻倍当前范围
                      * 第二次激进：扩展到最大允许范围的一半
                      * 第三次激进：扩展到最大允许范围
                    - 智能回退：如果扩展太多包含了无关内容，可以回退并重新尝试
                      * 记录关键的语义边界
                      * 在合适的位置回退
                    - 边界检查：注意检查文件的起始和结束位置
                      * 考虑文件边界的特殊情况
                      * 适当调整扩展策略

                7. 返回JSON格式，包含：
                    - line_change: 从可见文本中选择的行数
                    - need_more_context: 下一次要扩展可见文本的上/下文行数
                      * 发现不完整结构时必须 > 0
                      * 多次小范围扩展无效时可以给出更大的值
                    - reason: 选择的原因，必须说明：
                      * 完整性判断依据
                      * 为什么需要更多上下文（如果需要）
                      * 选择当前行数的理由
                    - completeness_check: 完整性评估：
                      * syntax_complete: 语法结构是否完整
                      * semantic_complete: 语义是否完整
                      * dependency_complete: 依赖关系是否完整
                      * extension_attempts: 已尝试扩展的次数
                      * suggested_strategy: 建议的下一步扩展策略

                示例：
                1. 代码示例：
                  对于上文：
                    - 如果看到函数开始，必须找到函数结束标记
                    - 如果看到类定义，必须包含完整的类实现
                    - 如果看到 try，必须包含对应的 catch/finally
                  对于下文：
                    - 如果看到函数结束，必须找到函数开始标记
                    - 如果看到疑似类结尾的结构，必须向上找到完整的类声明
                    - 如果看到 catch/finally，必须包含对应的 try
                2. 文本示例：
                    - 如果是段落开头，必须找到段落结束（如空行）
                    - 如果是列表项，必须包含完整的列表
                    - 如果是引用开始，必须找到引用结束
                3. 扩展示例：
                    - 第1-3次：使用20行扩展
                    - 第4次：翻倍扩展范围
                    - 第5次：扩展到最大范围的一半
                    - 第6次：扩展到最大允许范围

                注意：
                1. [已选] 标记的是已经选择的内容
                2. [可见] 标记的是新增的可见内容，编号规则：
                  - 上文：显示顺序是从远到近（编号大到小），但选择时从近到远（从小编号开始选）
                  - 下文：显示顺序是从近到远（编号小到大），选择时也是从近到远（从小编号开始选）
                  - 例如：选择3行时，无论上下文都是选择编号1,2,3的内容
                3. line_change > 0 时从[可见]内容中选择，总是优先选择编号较小的行（更靠近中心句的内容）
                4. line_change < 0 时从[已选]内容中删除，并且停止当前分析
                5. line_change = 0 时停止当前分析
                6. 宁可多选一些行，也不要破坏完整性
                7. 优先保证语义完整性，其次考虑精简行数
                8. 发现不完整结构时，必须设置need_more_context > 0
                9. 连续多次小范围扩展无效时，必须尝试更激进的扩展策略
                10. 禁止在以下位置截断：
                    - 函数/类定义中间
                    - 控制结构（if/for/while等）中间
                    - 括号未配对的位置
                    - 字符串/注释块中间
                    - 表达式中间"""
            },
            {
                "role": "user",
                "content": 
                f"""
                分析方向：{direction}

                已选内容：
                {selected_content.get('content', '')}

                可见内容：
                {visible_content.get('content', '')}

                请分析并返回JSON格式的建议。
                """
            }
        ]
        
        print(f"\n[{direction}分析] 分析新的可见内容")
        
        try:
            response = deepseek_client.chat.completions.create(
                model="deepseek-chat",
                messages=messages,
                response_format={"type": "json_object"}
            )
            
            suggestion = json.loads(response.choices[0].message.content)
            print(f"模型建议: {suggestion}")
            return suggestion
            
        except Exception as e:
            print(f"分析{direction}失败: {str(e)}")
            return {
                "line_change": 0,
                "need_more_context": 0,
                "reason": f"分析失败: {str(e)}",
                "completeness_check": {
                    "syntax_complete": False,
                    "semantic_complete": False,
                    "dependency_complete": False
                }
            }

class ProgressiveContextAnalyzer(ContextAnalyzer):
    def __init__(self, text_handler: TextHandler, max_single_context: int = 300, initial_context: int = 20):
        super().__init__(max_single_context, initial_context)
        self.text_handler = text_handler
        
    def analyze_progressive_context(
        self,
        file_id: str,
        user_id: str,
        target_line: int,
        is_up_context: bool = True,
    ) -> Dict[str, Any]:
        """渐进式分析上下文
        
        Args:
            file_id: 文件ID
            user_id: 用户ID
            target_line: 目标行号
            is_up_context: 是否分析上文
            
        Returns:
            Dict[str, Any]: {
                'success': bool,
                'selected_lines': List[int],  # 最终选择的行号列表
                'content': Dict[str, Any],    # 最终选择的内容
                'analysis_history': List[Dict] # 分析历史
            }
        """
        direction = "上文" if is_up_context else "下文"
        print(f"\n[渐进式分析{direction}] 开始分析目标行 {target_line}")
        
        # 初始化状态
        current_visible_lines = self.INITIAL_CONTEXT
        current_visible_target = target_line - 1 if is_up_context else target_line + 1
        total_selected_lines = 0  # 已选数，不包括中心句
        analysis_history = []
        
        # 获取目标行内容
        selected_content_temp = self.text_handler.get_text_by_lines(
            content_id=file_id,
            user_id=user_id,
            index_line=target_line,
            up_line_count=0,
            down_line_count=0
        )
        if not selected_content_temp.get('success'):
            return {
                'success': False,
                'error': f"获取已选内容失败: {selected_content_temp.get('error')}"
            }
        
        # 如果是第一行且要分析上文，或者是最后一行且要分析下文，直接返回
        if (is_up_context and target_line == 1) or (not is_up_context and target_line == self.text_handler.get_text_content(file_id, user_id)[1].get('line_count', 0)):
            return {
                'success': True,
                'selected_lines': 0,
                'content': {
                    'type': '已选',
                    'lines': [(target_line, selected_content_temp.get('content', ''))]
                },
                'analysis_history': []
            }
            
        # 构造初始的已选内容
        initial_context = {
            'line_number': target_line,
            'content': selected_content_temp.get('content', ''),
            'context_before': [],
            'context_after': []
        }
        
        # 格式化初始内容
        formatted_lines = []
        formatted_lines.append(f"[已选] {target_line}: {initial_context['content']}")
        selected_content = {
            'content': '\n'.join(formatted_lines)
        }
        
        try:
            while True:  # 使用无限循环，通过内部逻辑控制退出
                if total_selected_lines >= self.MAX_SINGLE_CONTEXT:
                    print(f"已达到最大上下文限制({self.MAX_SINGLE_CONTEXT}行)，停止分析")
                    break
                    
                print(f"\n[当前状态] 已选行数: {total_selected_lines}, 当前可见行数: {current_visible_lines}")
                
                # 1. 获取新的可见内容
                visible_content_temp = self.text_handler.get_text_by_lines(
                    content_id=file_id,
                    user_id=user_id,
                    index_line=current_visible_target,
                    up_line_count=current_visible_lines if is_up_context else 0,
                    down_line_count=0 if is_up_context else current_visible_lines
                )
                
                if not visible_content_temp.get('success'):
                    if total_selected_lines > 0:
                        print(f"已到达文件边界，使用当前已选内容")
                        break
                    return {
                        'success': False,
                        'error': f"获取可见内容失败: {visible_content_temp.get('error')}"
                    }
                
                # 检查是否到达文件边界
                reached_boundary = (is_up_context and visible_content_temp.get('reached_start')) or \
                                 (not is_up_context and visible_content_temp.get('reached_end'))
                
                # 2. 格式化可见内容
                visible_lines = []
                if is_up_context:
                    visible_lines.append(f"[可见] 1: {visible_content_temp.get('content', '')}")
                    for i, line in enumerate(reversed(visible_content_temp.get('context_before', [])), start=2):
                        visible_lines.append(f"[可见] {i}: {line}")
                else:
                    visible_lines.append(f"[可见] 1: {visible_content_temp.get('content', '')}")
                    for i, line in enumerate(visible_content_temp.get('context_after', []), start=2):
                        visible_lines.append(f"[可见] {i}: {line}")
                
                visible_content = {
                    'content': '\n'.join(visible_lines)
                }
                
                # 3. 使用基类的analyze_context进行分析
                suggestion = self.analyze_context(
                    selected_content=selected_content,
                    visible_content=visible_content,
                    is_up_context=is_up_context
                )
                
                # 4. 记录分析历史
                analysis_history.append({
                    'direction': direction,
                    'visible_target': current_visible_target,
                    'visible_lines': current_visible_lines,
                    'start_target': target_line,
                    'selected_lines': total_selected_lines,
                    'suggestion': suggestion
                })
                
                # 5. 处理分析结果
                line_change = suggestion.get('line_change', 0)
                need_more_context = suggestion.get('need_more_context', 0)
                
                # 如果模型建议不选择任何行且不需要更多上下文，直接结束
                if line_change <= 0 and need_more_context <= 0:
                    if line_change < 0:
                        deformat_content = self.format_text(selected_content.get('content', ''))
                        delete_lines = min(abs(line_change), total_selected_lines)
                        total_selected_lines = max(0, total_selected_lines - delete_lines)
                        deformat_content['lines'] = deformat_content['lines'][:len(deformat_content['lines'])-delete_lines]
                        selected_content = {
                            'content': self.deformat_text_from_format(deformat_content)
                        }
                        print(f"从已选内容中删除{delete_lines}行，当前已选{total_selected_lines}行")
                    print("分析完成，不需要更多行")
                    break
                
                # 从可见内容中选择新行
                selected_lines = min(line_change, len(visible_lines))  # 使用实际可见行数作为限制
                total_selected_lines += selected_lines
                
                # 处理内容
                deformat_selected = self.format_text(selected_content.get('content', ''))
                deformat_visible = self.format_text(visible_content.get('content', ''))
                selected_visible_lines = deformat_visible['lines'][:selected_lines]
                deformat_visible['lines'] = deformat_visible['lines'][selected_lines:]
                deformat_selected['lines'].extend(selected_visible_lines)
                deformat_selected['lines'].sort(key=lambda x: x[0])
                
                selected_content = {
                    'content': self.deformat_text_from_format(deformat_selected)
                }
                visible_content = {
                    'content': self.deformat_text_from_format(deformat_visible)
                }
                
                print(f"从可见内容中选择{selected_lines}行，当前已选{total_selected_lines}行")
                
                # 如果已到达文件边界且没有更多可选内容，结束分析
                if reached_boundary and len(deformat_visible['lines']) == 0:
                    print(f"已到达文件{'开始' if is_up_context else '结束'}且没有更多可选内容，分析完成")
                    break
                
                if need_more_context <= 0:
                    print("模型认为不需要更多上下文，分析完成")
                    break
                
                # 继续扩展
                if need_more_context > 0:
                    if is_up_context:
                        current_visible_target = target_line - total_selected_lines - 1
                    else:
                        current_visible_target = target_line + total_selected_lines + 1
                    
                    current_visible_lines = need_more_context
                    print(f"游标移动到{current_visible_target}行，将扩展{need_more_context}行")
                    
                    new_lines = self.text_handler.get_text_by_lines(
                        content_id=file_id,
                        user_id=user_id,
                        index_line=current_visible_target,
                        up_line_count=current_visible_lines if is_up_context else 0,
                        down_line_count=current_visible_lines if not is_up_context else 0
                    )
                    
                    if new_lines.get('success'):
                        visible_lines = []
                        if is_up_context:
                            visible_lines.append(f"[可见] 1: {new_lines.get('content', '')}")
                            for i, line in enumerate(reversed(new_lines.get('context_before', [])), start=2):
                                visible_lines.append(f"[可见] {i}: {line}")
                        else:
                            visible_lines.append(f"[可见] 1: {new_lines.get('content', '')}")
                            for i, line in enumerate(new_lines.get('context_after', []), start=2):
                                visible_lines.append(f"[可见] {i}: {line}")
                        
                        visible_content = {
                            'content': '\n'.join(visible_lines)
                        }
            
            # 6. 返回最终结果
            final_content = self.format_text(selected_content.get('content', ''))
            
            return {
                'success': True,
                'selected_lines': total_selected_lines,
                'content': final_content,
                'analysis_history': analysis_history
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"渐进式分析失败: {str(e)}",
                'analysis_history': analysis_history
            }
        
class TextReader:
    # 修改类常量
    MAX_SINGLE_UP_DOWN_CONTEXT = 300  # 单个目标行的上下文最大行数（上300行或下300行）
    MAX_TOTAL_QUERY_LINES = 50  # 总查询行数限制
    INITIAL_CONTEXT = 20  # 初始可见文本行数
    
    def __init__(self):
        self.text_handler = TextHandler()
        
    def read_full_text(self, file_id: str, user_id: str) -> Dict[str, Any]:
        """读取完整文本内容"""
        try:
            content, metadata = self.text_handler.get_text_content(file_id, user_id)
            total_lines = metadata.get('line_count', 0)
            
            if total_lines > self.MAX_TOTAL_QUERY_LINES:
                return {
                    'success': False,
                    'error': f'文件行数({total_lines})超过限制({self.MAX_TOTAL_QUERY_LINES}行)'
                }
                
            return {
                'success': True,
                'content': content,
                'encoding': metadata.get('encoding', 'utf-8'),
                'line_count': total_lines
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
            
    def read_lines_with_context(
        self,
        file_id: str,
        user_id: str,
        target_lines: List[int],
        up_line_count: int = 5,
        down_line_count: int = 5
    ) -> Dict[str, Any]:
        """读取指定行及其上下文"""
        try:    
            # 验证和限制上下文行数
            up_line_count = min(max(0, up_line_count), self.MAX_SINGLE_UP_DOWN_CONTEXT)
            down_line_count = min(max(0, down_line_count), self.MAX_SINGLE_UP_DOWN_CONTEXT)
            
            # 获取内容
            result = self.text_handler.get_text_by_multiple_lines(
                file_id,
                user_id,
                target_lines,
                up_line_count,
                down_line_count
            )
            
            if not result.get('success'):
                return result
                
            # 验证总行数是否超过限制
            total_context_lines = 0
            contexts = result.get('contexts', [])
            
            # 计算总行数
            for context in contexts:
                total_context_lines += len(context.get('context_before', []))
                total_context_lines += 1  # 目标行
                total_context_lines += len(context.get('context_after', []))
            
            # 如果超过限制，需要裁剪上下文
            if total_context_lines > self.MAX_TOTAL_QUERY_LINES:
                # 计算每个目标行平均可以分配的行数
                lines_per_target = self.MAX_TOTAL_QUERY_LINES // len(contexts)
                
                # 重新获取内容，使用调整后的上下文行数
                adjusted_up = min(up_line_count, (lines_per_target - 1) // 2)
                adjusted_down = min(down_line_count, (lines_per_target - 1) // 2)
                
                result = self.text_handler.get_text_by_multiple_lines(
                    file_id,
                    user_id,
                    target_lines,
                    adjusted_up,
                    adjusted_down
                )
            
            return result
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
            
    def read_lines_with_auto_context(self, file_id: str, user_id: str, target_lines: List[int]) -> Dict[str, Any]:
        """智能地读取多个目标行及其上下文
        
        Args:
            file_id: 文件ID
            user_id: 用户ID
            target_lines: 目标行号列表
            
        Returns:
            Dict[str, Any]: {
                'success': bool,
                'contexts': List[Dict],  # 每个目标行的上下文信息
                'error': Optional[str]   # 错误信息（如果有）
            }
        """
        try:
            # 创建上下文分析器
            analyzer = ProgressiveContextAnalyzer(
                text_handler=self.text_handler,
                max_single_context=self.MAX_SINGLE_UP_DOWN_CONTEXT,
                initial_context=self.INITIAL_CONTEXT
            )
            
            # 存储每个目标行的分析结果
            line_results = []
            
            # 1. 对每个目标行分别分析上下文和下文
            for target_line in target_lines:
                print(f"\n[分析目标行 {target_line}]")
                
                # 获取目标行内容
                target_content = self.text_handler.get_text_by_lines(
                    content_id=file_id,
                    user_id=user_id,
                    index_line=target_line,
                    up_line_count=0,
                    down_line_count=0
                )
                
                if not target_content.get('success'):
                    return {
                        'success': False,
                        'error': f"获取目标行内容失败: {target_content.get('error')}"
                    }
                
                # 分析上文
                up_context = analyzer.analyze_progressive_context(
                    file_id=file_id,
                    user_id=user_id,
                    target_line=target_line,
                    is_up_context=True
                )
                
                # 分析下文
                down_context = analyzer.analyze_progressive_context(
                    file_id=file_id,
                    user_id=user_id,
                    target_line=target_line,
                    is_up_context=False
                )
                
                # 解析上下文内容
                up_content = {'lines': []} if not up_context.get('success') else up_context.get('content', {'lines': []})
                down_content = {'lines': []} if not down_context.get('success') else down_context.get('content', {'lines': []})
                
                # 合并结果
                line_results.append({
                    'target_line': target_line,
                    'up_content': up_content,
                    'down_content': down_content,
                    'up_history': up_context.get('analysis_history', []),
                    'down_history': down_context.get('analysis_history', [])
                })
            
            # 2. 合并重叠的上下文
            merged_contexts = []
            for i, result in enumerate(line_results):
                target_line = result['target_line']
                
                # 提取上文和下文的行
                context_before = []
                context_after = []
                target_content = None
                
                # 处理上文
                up_lines = result['up_content'].get('lines', [])
                for line_num, content in up_lines:
                    if line_num < target_line:  # 只添加目标行之前的内容
                        context_before.append(content)
                    elif line_num == target_line:
                        target_content = content
                
                # 处理下文
                down_lines = result['down_content'].get('lines', [])
                for line_num, content in down_lines:
                    if line_num > target_line:  # 只添加目标行之后的内容
                        context_after.append(content)
                    elif line_num == target_line and not target_content:
                        target_content = content
                
                # 如果没有从上下文中获取到目标行内容，使用直接获取的内容
                if not target_content and target_line in target_lines:
                    current_target_content = self.text_handler.get_text_by_lines(
                        content_id=file_id,
                        user_id=user_id,
                        index_line=target_line,
                        up_line_count=0,
                        down_line_count=0
                    )
                    target_content = current_target_content.get('content', '')
                
                # 创建上下文对象
                context = {
                    'line_number': target_line,
                    'content': target_content,
                    'context_before': context_before,
                    'context_after': context_after
                }
                
                # 检查是否与前一个上下文重叠
                if merged_contexts and i > 0:
                    prev_context = merged_contexts[-1]
                    prev_line = prev_context['line_number']
                    
                    # 如果当前上文与前一个下文重叠
                    if target_line - len(context_before) <= prev_line + len(prev_context['context_after']):
                        # 找到重叠点
                        overlap_start = prev_line + 1
                        overlap_end = target_line - 1
                        
                        # 移除重叠的行
                        non_overlap_before = []
                        for line in context_before:
                            if overlap_start <= target_line - len(context_before) + len(non_overlap_before) <= overlap_end:
                                continue
                            non_overlap_before.append(line)
                        context['context_before'] = non_overlap_before
                
                merged_contexts.append(context)
            
            return {
                'success': True,
                'contexts': merged_contexts
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"自动上下文分析失败: {str(e)}"
            }
        
    def search_text_with_keyword(
        self,
        file_id: str,
        user_id: str,
        keyword: str,
        max_matches: int = 10,
        up_line_count: int = 5,
        down_line_count: int = 5,
        auto_context: bool = True
    ) -> Dict[str, Any]:
        """使用关键词搜索文本内容
        
        Args:
            file_id: 文件ID
            user_id: 用户ID
            keyword: 搜索关键词
            max_matches: 最大匹配数量
            up_line_count: 向上获取的行数（仅在auto_context=False时使用）
            down_line_count: 向下获取的行数（仅在auto_context=False时使用）
            auto_context: 是否自动分析上下文
            
        Returns:
            Dict[str, Any]: {
                'success': bool,
                'matches': List[Dict],  # 匹配结果列表，每项包含：
                    {
                        'line_number': int,      # 匹配行号
                        'content': str,          # 匹配行内容
                        'context_before': List[str], # 上文
                        'context_after': List[str],  # 下文
                        'keyword_positions': List[int] # 关键词在行中的位置
                    }
                'total_matches': int,   # 总匹配数
                'error': Optional[str]  # 错误信息（如果有）
                'metadata': Dict[str, Any]  # 元数据，包含：
                    {
                        'file_name': str,    # 文件名
                        'encoding': str,     # 文件编码
                        'total_lines': int,  # 文件总行数
                        'search_stats': Dict[str, Any]  # 搜索统计信息
                    }
            }
        """
        try:
            # 使用TextHandler进行搜索
            if auto_context:
                # 先获取匹配行
                basic_result = self.text_handler.search_text_by_keyword(
                    file_id,
                    user_id,
                    keyword,
                    max_matches,
                    0,  # 不获取上下文，后面会自动分析
                    0
                )
                
                if not basic_result.get('success'):
                    return basic_result
                
                # 提取匹配的行号
                target_lines = []
                for context in basic_result.get('contexts', []):
                    if context.get('line_number'):
                        target_lines.append(context['line_number'])
                
                # 使用自动上下文分析
                context_result = self.read_lines_with_auto_context(
                    file_id,
                    user_id,
                    target_lines
                )
                
                if not context_result.get('success'):
                    return context_result
                
            else:
                # 使用固定上下文行数
                context_result = self.text_handler.search_text_by_keyword(
                    file_id,
                    user_id,
                    keyword,
                    max_matches,
                    up_line_count,
                    down_line_count
                )
            
            # 获取文件元数据
            _, metadata = self.text_handler.get_text_content(file_id, user_id)
            
            # 处理结果，添加关键词位置信息
            matches = []
            for context in context_result.get('contexts', []):
                content = context.get('content', '')
                # 查找关键词的所有位置
                positions = []
                start = 0
                while True:
                    pos = content.find(keyword, start)
                    if pos == -1:
                        break
                    positions.append(pos)
                    start = pos + 1
                
                matches.append({
                    'line_number': context.get('line_number'),
                    'content': content,
                    'context_before': context.get('context_before', []),
                    'context_after': context.get('context_after', []),
                    'keyword_positions': positions
                })
            
            # 构造搜索统计信息
            search_stats = {
                'keyword': keyword,
                'matches_found': len(matches),
                'max_matches': max_matches,
                'auto_context': auto_context,
                'context_lines': {
                    'up': up_line_count if not auto_context else 'auto',
                    'down': down_line_count if not auto_context else 'auto'
                }
            }
            
            return {
                'success': True,
                'matches': matches,
                'total_matches': len(matches),
                'metadata': {
                    'file_name': metadata.get('file_name'),
                    'encoding': metadata.get('encoding'),
                    'total_lines': metadata.get('line_count'),
                    'search_stats': search_stats
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"关键词搜索失败: {str(e)}"
            }
    
    def search_text_with_keywords(
        self,
        file_id: str,
        user_id: str,
        keyword_configs: List[Dict[str, Any]],
        auto_context: bool = True
    ) -> Dict[str, Any]:
        """使用多个关键词搜索文本内容
        
        Args:
            file_id: 文件ID
            user_id: 用户ID
            keyword_configs: List[Dict[str, Any]]  # 关键词配置列表，每项包含：
                {
                    'keyword': str,        # 关键词
                    'max_matches': int,    # 最大匹配数量
                    'up_line_count': int,  # 向上获取的行数（仅在auto_context=False时使用）
                    'down_line_count': int # 向下获取的行数（仅在auto_context=False时使用）
                }
            auto_context: 是否自动分析上下文
            
        Returns:
            Dict[str, Any]: {
                'success': bool,
                'matches': List[Dict],  # 匹配结果列表，每项包含：
                    {
                        'line_number': int,      # 匹配行号
                        'content': str,          # 匹配行内容
                        'context_before': List[str], # 上文
                        'context_after': List[str],  # 下文
                        'matched_keywords': List[Dict]  # 匹配的关键词信息列表
                            {
                                'keyword': str,      # 关键词
                                'positions': List[int] # 关键词在行中的位置
                            }
                    }
                'total_matches': int,   # 总匹配数
                'error': Optional[str]  # 错误信息（如果有）
                'metadata': Dict[str, Any]  # 元数据
            }
        """
        try:
            if auto_context:
                # 先获取所有匹配行
                basic_result = self.text_handler.search_text_by_keywords(
                    file_id,
                    user_id,
                    [{
                        'keyword': config['keyword'],
                        'max_matches': config.get('max_matches', 10),
                        'up_line_count': 0,
                        'down_line_count': 0
                    } for config in keyword_configs]
                )
                
                if not basic_result.get('success'):
                    return basic_result
                
                # 提取匹配的行号
                target_lines = []
                for context in basic_result.get('contexts', []):
                    if context.get('line_number'):
                        target_lines.append(context['line_number'])
                
                # 使用自动上下文分析
                context_result = self.read_lines_with_auto_context(
                    file_id,
                    user_id,
                    target_lines
                )
                
                if not context_result.get('success'):
                    return context_result
                
            else:
                # 使用固定上下文行数
                context_result = self.text_handler.search_text_by_keywords(
                    file_id,
                    user_id,
                    keyword_configs
                )
            
            # 获取文件元数据
            _, metadata = self.text_handler.get_text_content(file_id, user_id)
            
            # 处理结果，添加关键词位置信息
            matches = []
            for context in context_result.get('contexts', []):
                content = context.get('content', '')
                matched_keywords = []
                
                # 查找每个关键词的位置
                for config in keyword_configs:
                    keyword = config['keyword']
                    positions = []
                    start = 0
                    while True:
                        pos = content.find(keyword, start)
                        if pos == -1:
                            break
                        positions.append(pos)
                        start = pos + 1
                    
                    if positions:  # 只添加在当前行中找到的关键词
                        matched_keywords.append({
                            'keyword': keyword,
                            'positions': positions
                        })
                
                matches.append({
                    'line_number': context.get('line_number'),
                    'content': content,
                    'context_before': context.get('context_before', []),
                    'context_after': context.get('context_after', []),
                    'matched_keywords': matched_keywords
                })
            
            # 构造搜索统计信息
            search_stats = {
                'keywords': [config['keyword'] for config in keyword_configs],
                'matches_found': len(matches),
                'auto_context': auto_context,
                'keyword_configs': keyword_configs
            }
            
            return {
                'success': True,
                'matches': matches,
                'total_matches': len(matches),
                'metadata': {
                    'file_name': metadata.get('file_name'),
                    'encoding': metadata.get('encoding'),
                    'total_lines': metadata.get('line_count'),
                    'search_stats': search_stats
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"多关键词搜索失败: {str(e)}"
            }
        