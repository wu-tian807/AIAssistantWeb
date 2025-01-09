import json
from typing import Dict, Any, List
from utils.text_attachment.text_reader import TextReader
from utils.attachment_handler.text_handler import TextHandler
from initialization import deepseek_client


class TextProcessor:
    def __init__(self):
        self.reader = TextReader()
        
    def define_tools(self):
        return [
            {
                "type": "function",
                "function": {
                    "name": "read_full_text",
                    "description": "读取整个文本文件的内容。当用户想要查看全部内容时使用此函数。注意：总行数不能超过50行。参数 file_id 固定为 1736427661431。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "file_id": {
                                "type": "string",
                                "description": "文件ID，固定值：1736427661431"
                            }
                        },
                        "required": ["file_id"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "read_lines_with_context",
                    "description": "【不推荐】手动指定上下文范围来读取指定行的内容。除非用户明确要求指定上下文行数，否则请使用 read_lines_with_auto_context。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "file_id": {
                                "type": "string",
                                "description": "文件ID，固定值：1736427661431"
                            },
                            "target_lines": {
                                "type": "array",
                                "items": {"type": "integer"},
                                "description": "要读取的目标行号列表。例如：[1,8] 表示读取第1行和第8行"
                            },
                            "up_line_count": {
                                "type": "integer",
                                "description": "向上读取的行数，最大300行",
                                "default": 5
                            },
                            "down_line_count": {
                                "type": "integer",
                                "description": "向下读取的行数，最大300行",
                                "default": 5
                            }
                        },
                        "required": ["file_id", "target_lines"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "read_lines_with_auto_context",
                    "description": "【推荐】智能地读取指定行的内容。这个函数会：1. 自动分析代码/文本结构 2. 智能决定需要的上下文范围 3. 确保上下文的完整性（如完整的函数块、类定义等）。当用户要查看某行内容时，默认使用此函数。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "file_id": {
                                "type": "string",
                                "description": "文件ID，固定值：1736427661431"
                            },
                            "target_lines": {
                                "type": "array",
                                "items": {"type": "integer"},
                                "description": "要读取的目标行号列表。例如：[1,8] 表示读取第1行和第8行"
                            }
                        },
                        "required": ["file_id", "target_lines"]
                    }
                }
            }
        ]

    def read_full_text(self, file_id: str) -> str:
        """读取完整文本"""
        result = self.reader.read_full_text(
            file_id=file_id,
            user_id="2212929908_qq_com"
        )
        if isinstance(result, dict) and result.get('success'):
            return result.get('content', '')
        return str(result.get('error', '读取失败'))

    def read_lines_with_context(self, file_id: str, target_lines: list, up_line_count: int, down_line_count: int) -> str:
        """读取指定行及上下文"""
        result = self.reader.read_lines_with_context(
            file_id=file_id,
            user_id="2212929908_qq_com",
            target_lines=target_lines,
            up_line_count=up_line_count,
            down_line_count=down_line_count
        )
        
        if isinstance(result, dict) and result.get('success'):
            # 格式化输出上下文内容
            output = []
            for context in result.get('contexts', []):
                # 添加上文
                if context.get('context_before'):
                    output.extend(context['context_before'])
                # 添加目标行
                if context.get('content'):
                    output.append(f">>> {context['content']}")  # 使用 >>> 标记目标行
                # 添加下文
                if context.get('context_after'):
                    output.extend(context['context_after'])
                output.append('')  # 添加空行分隔不同段落
            
            return '\n'.join(output)
        return str(result.get('error', '读取失败'))

    def read_lines_with_auto_context(self, file_id: str, target_lines: list) -> str:
        """智能地读取指定行及上下文"""
        print("\n[开始智能上下文分析]")
        result = self.reader.read_lines_with_auto_context(
            file_id=file_id,
            user_id="2212929908_qq_com",
            target_lines=target_lines
        )
        
        print(f"\n[分析结果] {result}")
        
        if isinstance(result, dict) and result.get('success'):
            # 格式化输出上下文内容
            output = []
            for context in result.get('contexts', []):
                # 添加上文
                if context.get('context_before'):
                    print(f"上文行数: {len(context['context_before'])}")
                    output.extend(context['context_before'])
                # 添加目标行
                if context.get('content'):
                    print(f"目标行: {context['content']}")
                    output.append(f">>> {context['content']}")  # 使用 >>> 标记目标行
                # 添加下文
                if context.get('context_after'):
                    print(f"下文行数: {len(context['context_after'])}")
                    output.extend(context['context_after'])
                output.append('')  # 添加空行分隔不同段落
            
            return '\n'.join(output)
        return str(result.get('error', '读取失败'))

def process_tool_call(processor, tool_call):
    """处理工具调用，包含参数验证和默认值处理"""
    print(f"\n调试 - 工具调用参数: {tool_call}")
    
    if not tool_call.get("function", {}).get("name"):
        return "工具调用失败: 无效的工具调用"
        
    function_name = tool_call["function"]["name"]
    try:
        try:
            arguments = json.loads(tool_call["function"]["arguments"]) if tool_call["function"].get("arguments") else {}
            print(f"调试 - 解析后的参数: {arguments}")
        except json.JSONDecodeError:
            print(f"[警告: 参数解析失败，使用默认值]")
            arguments = {}

        arguments["file_id"] = arguments.get("file_id", "1736427661431")
        print(f"调试 - 最终参数: {arguments}")
        
        result = None
        if function_name == "read_full_text":
            result = processor.read_full_text(arguments["file_id"])
        elif function_name == "read_lines_with_context":
            if "target_lines" not in arguments:
                raise ValueError("必须指定目标行号")
            result = processor.read_lines_with_context(
                file_id=arguments["file_id"],
                target_lines=arguments["target_lines"],
                up_line_count=arguments.get("up_line_count", 5),
                down_line_count=arguments.get("down_line_count", 5)
            )
        elif function_name == "read_lines_with_auto_context":
            if "target_lines" not in arguments:
                raise ValueError("必须指定目标行号")
            result = processor.read_lines_with_auto_context(
                file_id=arguments["file_id"],
                target_lines=arguments["target_lines"]
            )
        else:
            raise ValueError(f"未知的工具名称: {function_name}")

        print(f"调试 - 工具调用结果: {result}")
        return result if result is not None else "工具调用返回空结果"
        
    except Exception as e:
        error_msg = str(e)
        print(f"[工具调用失败: {function_name}] - {error_msg}")
        return f"工具调用失败: {error_msg}"

def simulate_conversation():
    processor = TextProcessor()
    file_id = "1736427661431"
    
    print("\n欢迎使用文件阅读助手！")
    print("请输入您的问题(输入 'quit' 退出):")
    
    while True:
        user_input = input("\n用户: ").strip()
        
        if user_input.lower() == 'quit':
            print("\n感谢使用，再见！")
            break
        
        if not user_input:
            print("请输入有效的问题！")
            continue
            
        messages = [{"role": "user", "content": user_input}]
        tools = processor.define_tools()
        
        try:
            stream = deepseek_client.chat.completions.create(
                model="deepseek-chat",
                messages=messages,
                tools=tools,
                stream=True
            )
            
            # 状态变量
            function_arguments = ""
            function_name = ""
            function_id = ""
            is_collecting_function_args = False
            collected_message = {"role": "assistant", "content": "", "tool_calls": []}
            
            print("\n助手: ", end="", flush=True)
            for part in stream:
                if not part.choices:
                    continue
                    
                delta = part.choices[0].delta
                finish_reason = part.choices[0].finish_reason
                
                # 处理助手内容
                if delta.content:
                    collected_message["content"] += delta.content
                    print(delta.content, end="", flush=True)
                
                # 处理工具调用
                if delta.tool_calls:
                    is_collecting_function_args = True
                    tool_call = delta.tool_calls[0]
                    
                    if tool_call.function.name:
                        function_name = tool_call.function.name
                        function_id = tool_call.id
                    
                    if tool_call.function.arguments:
                        function_arguments += tool_call.function.arguments
                
                # 处理完整的工具调用
                if finish_reason == "tool_calls" and is_collecting_function_args:
                    print(f"\n[调试] 工具调用完成: {function_name}")
                    
                    # 构造完整的工具调用
                    tool_call = {
                        "id": function_id,
                        "type": "function",
                        "function": {
                            "name": function_name,
                            "arguments": function_arguments
                        }
                    }
                    
                    # 处理工具调用
                    tool_result = process_tool_call(processor, tool_call)
                    
                    # 添加消息
                    collected_message["tool_calls"].append(tool_call)
                    messages.append(collected_message)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": function_id,
                        "content": tool_result
                    })
                    
                    # 获取最终响应
                    final_response = deepseek_client.chat.completions.create(
                        model="deepseek-chat",
                        messages=messages,
                        stream=True
                    )
                    
                    print("\n助手: ", end="", flush=True)
                    for chunk in final_response:
                        if chunk.choices[0].delta.content:
                            print(chunk.choices[0].delta.content, end="", flush=True)
                    print("\n")
                    
                    # 重置状态
                    function_arguments = ""
                    function_name = ""
                    function_id = ""
                    is_collecting_function_args = False
                
        except Exception as e:
            print(f"\n对话出错: {str(e)}")
            print("请重试或输入 'quit' 退出")

if __name__ == "__main__":
    simulate_conversation()
    