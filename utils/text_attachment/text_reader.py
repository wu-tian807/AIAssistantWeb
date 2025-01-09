import os
import json
from typing import List, Tuple, Dict, Any
from utils.attachment_handler.text_handler import TextHandler
from initialization import deepseek_client

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
        """自动决定上下文行数，采用渐进式分析方法"""
        try:
            print("\n[自动上下文分析开始]")
            print(f"目标行: {target_lines}")
            
            # 1. 先获取目标行的纯内容
            print("\n[第1步] 获取目标行的纯内容")
            center_content = self.read_lines_with_context(file_id, user_id, target_lines, 0, 0)
            if not center_content.get('success'):
                return center_content
            
            print(f"获取到的目标行内容: {center_content}")
            
            # 初始化参数
            INITIAL_CONTEXT = 10  # 初始可见文本行数
            total_up_lines = 0  # 已选择的上文行数
            total_down_lines = 0  # 已选择的下文行数
            visible_up_lines = 0  # 当前可见的上文行数
            visible_down_lines = 0  # 当前可见的下文行数
            
            def format_text_with_lines(content: Dict[str, Any], start_from: int = 1, selected: bool = False) -> str:
                """格式化文本内容，添加行号"""
                formatted_lines = []
                current_line = start_from
                
                for context in content.get('contexts', []):
                    # 添加上文
                    for line in context.get('context_before', []):
                        formatted_lines.append(f"{'[已选]' if selected else '[可见]'} {current_line}: {line}")
                        current_line += 1
                    
                    # 添加目标行
                    if context.get('content'):
                        formatted_lines.append(f"{'[已选]' if selected else '[可见]'} {current_line}: {context['content']}")
                        current_line += 1
                    
                    # 添加下文
                    for line in context.get('context_after', []):
                        formatted_lines.append(f"{'[已选]' if selected else '[可见]'} {current_line}: {line}")
                        current_line += 1
                
                return '\n'.join(formatted_lines)
            
            def get_visible_content(file_id: str, user_id: str, target_lines: List[int], 
                                 total_lines: int, visible_lines: int, is_up: bool = True) -> Dict[str, Any]:
                """获取不重叠的可见内容"""
                if is_up:
                    # 上文：从total_lines之前开始读取
                    start = max(0, visible_lines - total_lines)
                    return self.read_lines_with_context(
                        file_id=file_id,
                        user_id=user_id,
                        target_lines=target_lines,
                        up_line_count=visible_lines,
                        down_line_count=0
                    )
                else:
                    # 下文：从total_lines之后开始读取
                    return self.read_lines_with_context(
                        file_id=file_id,
                        user_id=user_id,
                        target_lines=target_lines,
                        up_line_count=0,
                        down_line_count=visible_lines
                    )
            
            # 2. 分析上文
            print("\n[分析上文]")
            continue_up_analysis = True
            while continue_up_analysis and total_up_lines < self.MAX_SINGLE_UP_DOWN_CONTEXT:
                # 获取已选内容
                selected_content = self.read_lines_with_context(
                    file_id=file_id,
                    user_id=user_id,
                    target_lines=target_lines,
                    up_line_count=total_up_lines,
                    down_line_count=0
                )
                
                # 获取新的可见上文（不包含已选内容）
                next_visible_up = visible_up_lines + INITIAL_CONTEXT
                visible_content = get_visible_content(
                    file_id=file_id,
                    user_id=user_id,
                    target_lines=target_lines,
                    total_lines=total_up_lines,
                    visible_lines=next_visible_up,
                    is_up=True
                )
                
                if not visible_content.get('success'):
                    break
                
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
                           - 保持上下文连贯性：相关的内容必须保持在一起
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
                           - need_more_context: 下一次要扩展的行数
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
                           - 如果看到函数开始，必须找到函数结束标记
                           - 如果看到类定义，必须包含完整的类实现
                           - 如果看到 try，必须包含对应的 catch/finally
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
                        2. [可见] 标记的是新增的可见内容
                        3. line_change > 0 时从[可见]内容中选择
                        4. line_change < 0 时从[已选]内容中删除
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
                        已选内容：
                        {format_text_with_lines(selected_content, 1, True)}

                        可见内容：
                        {format_text_with_lines(visible_content, total_up_lines + 1, False)}

                        请分析并返回JSON格式的建议。
                        """
                    }
                ]
                
                print(f"\n[上文分析] 当前已选{total_up_lines}行，新增{INITIAL_CONTEXT}行可见内容")
                
                response = deepseek_client.chat.completions.create(
                    model="deepseek-chat",
                    messages=messages,
                    response_format={"type": "json_object"}
                )
                
                try:
                    suggestion = json.loads(response.choices[0].message.content)
                    print(f"模型建议: {suggestion}")
                    
                    line_change = suggestion.get('line_change', 0)
                    
                    if line_change < 0:
                        # 如果是负数，从已选内容中删除行数（注意边界）
                        delete_lines = min(abs(line_change), total_up_lines)
                        total_up_lines = max(0, total_up_lines - delete_lines)
                        print(f"从已选内容中删除{delete_lines}行，最终保留{total_up_lines}行")
                        break
                    elif line_change > 0:
                        # 如果是正数，从可见文本中选择行数
                        available_lines = next_visible_up - visible_up_lines
                        selected_lines = min(line_change, available_lines)
                        total_up_lines += selected_lines
                        total_up_lines = min(total_up_lines, self.MAX_SINGLE_UP_DOWN_CONTEXT)
                        print(f"从可见文本中选择{selected_lines}行，总计已选{total_up_lines}行")
                        
                        # 更新可见文本范围
                        visible_up_lines = next_visible_up
                        
                        # 获取下一次要拓展的行数
                        next_context = suggestion.get('need_more_context', 0)
                        if next_context > 0:
                            INITIAL_CONTEXT = next_context
                            continue_up_analysis = True
                            print(f"下一次将拓展{next_context}行")
                        else:
                            continue_up_analysis = False
                    else:
                        # 如果是0，停止分析
                        print("不选择更多行，停止分析")
                        break
                        
                except Exception as e:
                    print(f"解析模型建议失败: {str(e)}")
                    break
            
            # 3. 分析下文（逻辑同上文）
            print("\n[分析下文]")
            continue_down_analysis = True
            while continue_down_analysis and total_down_lines < self.MAX_SINGLE_UP_DOWN_CONTEXT:
                # 获取已选内容
                selected_content = self.read_lines_with_context(
                    file_id=file_id,
                    user_id=user_id,
                    target_lines=target_lines,
                    up_line_count=0,
                    down_line_count=total_down_lines
                )
                
                # 获取新的可见下文（不包含已选内容）
                next_visible_down = visible_down_lines + INITIAL_CONTEXT
                visible_content = get_visible_content(
                    file_id=file_id,
                    user_id=user_id,
                    target_lines=target_lines,
                    total_lines=total_down_lines,
                    visible_lines=next_visible_down,
                    is_up=False
                )
                
                if not visible_content.get('success'):
                    break
                
                # 构造提示让模型分析下文
                messages = [
                    {
                        "role": "system",
                        "content": r"""你是一个代码/文本分析助手。你的任务是：
                        1. 分析新获取的下文片段，判断其与中心内容的相关性
                        2. 在保证上下文完整性的前提下，尽可能减少下文数量
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
                           - 保持上下文连贯性：相关的内容必须保持在一起
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
                           - need_more_context: 下一次要扩展的行数
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
                           - 如果看到函数开始，必须找到函数结束标记
                           - 如果看到类定义，必须包含完整的类实现
                           - 如果看到 try，必须包含对应的 catch/finally
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
                        2. [可见] 标记的是新增的可见内容
                        3. line_change > 0 时从[可见]内容中选择
                        4. line_change < 0 时从[已选]内容中删除
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
                        已选内容：
                        {format_text_with_lines(selected_content, 1, True)}

                        可见内容：
                        {format_text_with_lines(visible_content, total_down_lines + 1, False)}

                        请分析并返回JSON格式的建议。
                        """
                    }
                ]
                
                print(f"\n[下文分析] 当前已选{total_down_lines}行，新增{INITIAL_CONTEXT}行可见内容")
                
                response = deepseek_client.chat.completions.create(
                    model="deepseek-chat",
                    messages=messages,
                    response_format={"type": "json_object"}
                )
                
                try:
                    suggestion = json.loads(response.choices[0].message.content)
                    print(f"模型建议: {suggestion}")
                    
                    line_change = suggestion.get('line_change', 0)
                    
                    if line_change < 0:
                        # 如果是负数，从已选内容中删除行数（注意边界）
                        delete_lines = min(abs(line_change), total_down_lines)
                        total_down_lines = max(0, total_down_lines - delete_lines)
                        print(f"从已选内容中删除{delete_lines}行，最终保留{total_down_lines}行")
                        break
                    elif line_change > 0:
                        # 如果是正数，从可见文本中选择行数
                        available_lines = next_visible_down - visible_down_lines
                        selected_lines = min(line_change, available_lines)
                        total_down_lines += selected_lines
                        total_down_lines = min(total_down_lines, self.MAX_SINGLE_UP_DOWN_CONTEXT)
                        print(f"从可见文本中选择{selected_lines}行，总计已选{total_down_lines}行")
                        
                        # 更新可见文本范围
                        visible_down_lines = next_visible_down
                        
                        # 获取下一次要拓展的行数
                        next_context = suggestion.get('need_more_context', 0)
                        if next_context > 0:
                            INITIAL_CONTEXT = next_context
                            continue_down_analysis = True
                            print(f"下一次将拓展{next_context}行")
                        else:
                            continue_down_analysis = False
                    else:
                        # 如果是0，停止分析
                        print("不选择更多行，停止分析")
                        break
                        
                except Exception as e:
                    print(f"解析模型建议失败: {str(e)}")
                    break
            
            # 4. 获取最终结果
            print("\n[获取最终结果]")
            print(f"最终上下文范围: 上文{total_up_lines}行，下文{total_down_lines}行")
            
            final_result = self.read_lines_with_context(
                file_id=file_id,
                user_id=user_id,
                target_lines=target_lines,
                up_line_count=total_up_lines,
                down_line_count=total_down_lines
            )
            
            # 去掉序列化编号，只保留原始文本
            if final_result.get('success'):
                for context in final_result.get('contexts', []):
                    # 处理上文
                    if 'context_before' in context:
                        context['context_before'] = [
                            line.split(': ', 1)[-1] if ': ' in line else line 
                            for line in context['context_before']
                        ]
                    # 处理目标行
                    if 'content' in context:
                        context['content'] = context['content'].split(': ', 1)[-1] if ': ' in context['content'] else context['content']
                    # 处理下文
                    if 'context_after' in context:
                        context['context_after'] = [
                            line.split(': ', 1)[-1] if ': ' in line else line 
                            for line in context['context_after']
                        ]
            
            return final_result
            
        except Exception as e:
            return {
                'success': False,
                'error': f"自动上下文获取失败: {str(e)}"
            }

