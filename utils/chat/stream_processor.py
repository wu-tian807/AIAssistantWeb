import json
import traceback
from typing import Dict, List, Any, Generator, Optional, Union, Tuple

# 导入工具处理相关函数
from tools.tool_processor import process_streaming_tool_call, format_tool_results

def process_stream_response(
    stream: Any, 
    is_reasoner: bool, 
    accumulated_output: List[str]
) -> Tuple[Generator[str, None, None], Any]:
    """
    处理来自AI模型的流式响应数据，并返回一个生成器和最后的响应chunk
    
    Args:
        stream: AI模型返回的流式响应对象
        is_reasoner: 是否为reasoner模式
        accumulated_output: 用于累积输出内容的列表
        
    Returns:
        Tuple[Generator[str, None, None], Any]: 
            - 生成器，产生格式化为SSE的响应数据
            - 最后一个响应chunk，用于token统计
    """
    def stream_generator():
        # 使用可变对象来存储最后一个chunk，避免使用nonlocal
        last_chunk_container = {"value": None}
        
        # 存储工具调用数据
        tool_calls_data = []
        current_tool_call = None
        
        # 存储工具调用结果，用于添加到历史记录
        tool_response_messages = []
        
        if is_reasoner:
            print("使用reasoner模式")
            for chunk in stream:
                # 保存最后一个chunk
                last_chunk_container["value"] = chunk
                try:
                    reasoning_content = None
                    content = None
                    
                    # 检查是否有工具调用
                    if hasattr(chunk.choices[0].delta, 'tool_calls') and chunk.choices[0].delta.tool_calls:
                        print("\n!!! 推理模式下发现工具调用 !!!")
                        print(f"tool_calls: {chunk.choices[0].delta.tool_calls}")
                        
                        # 处理工具调用
                        for tc in chunk.choices[0].delta.tool_calls:
                            tool_id = tc.id if hasattr(tc, 'id') else None
                            tool_index = tc.index if hasattr(tc, 'index') else 0
                            
                            if hasattr(tc, 'function'):
                                func_name = tc.function.name if hasattr(tc.function, 'name') else None
                                func_args = tc.function.arguments if hasattr(tc.function, 'arguments') else None
                                
                                # 收集工具调用数据
                                if tool_id:
                                    existing_call = next((t for t in tool_calls_data if t.get('id') == tool_id), None)
                                    
                                    if not existing_call:
                                        tool_call_data = {
                                            'id': tool_id,
                                            'index': tool_index,
                                            'function': {
                                                'name': func_name,
                                                'arguments': ''
                                            }
                                        }
                                        tool_calls_data.append(tool_call_data)
                                        current_tool_call = tool_call_data
                                    else:
                                        current_tool_call = existing_call
                                    
                                    # 累积函数参数
                                    if func_args and current_tool_call:
                                        current_tool_call['function']['arguments'] += func_args
                    
                    if hasattr(chunk.choices[0].delta, 'reasoning_content') and chunk.choices[0].delta.reasoning_content is not None:
                        reasoning_content = chunk.choices[0].delta.reasoning_content
                        accumulated_output.append(reasoning_content)
                        # 立即发送推理内容
                        response = f"data: {json.dumps({'reasoning_content': reasoning_content})}\n\n"
                        yield response
                        # 强制刷新
                        if hasattr(response, 'flush'):
                            response.flush()
                    elif hasattr(chunk.choices[0].delta, 'content') and chunk.choices[0].delta.content is not None:
                        content = chunk.choices[0].delta.content
                        accumulated_output.append(content)
                        # 立即发送内容
                        try:
                            response = f"data: {json.dumps({'content': content})}\n\n"
                            yield response
                            # 强制刷新
                            if hasattr(response, 'flush'):
                                response.flush()
                        except Exception as e:
                            print(f"JSON序列化错误: {str(e)}, 内容: {content}")
                            # 尝试使用安全的JSON序列化
                            try:
                                response = f"data: {json.dumps({'content': content}, ensure_ascii=False)}\n\n"
                                yield response
                            except:
                                print("无法序列化内容，跳过")
                    
                    # 检查是否工具调用结束
                    if hasattr(chunk.choices[0], 'finish_reason') and chunk.choices[0].finish_reason == 'tool_calls':
                        print("\n*** 推理模式下工具调用结束 ***")
                        # 执行工具并处理结果
                        for tool_call in tool_calls_data:
                            tool_id = tool_call.get('id')
                            tool_name = tool_call.get('function', {}).get('name')
                            tool_args_str = tool_call.get('function', {}).get('arguments', '{}')
                            
                            try:
                                tool_args = json.loads(tool_args_str) if isinstance(tool_args_str, str) else tool_args_str
                            except json.JSONDecodeError:
                                error_msg = f"工具参数解析错误: {tool_args_str}"
                                print(error_msg)
                                continue
                            
                            # 执行工具并处理流式响应
                            for tool_response in process_streaming_tool_call(tool_name, tool_args, tool_id):
                                response_type = tool_response.get('type')
                                response_data = tool_response.get('data', {})
                                
                                if response_type == 'tool_step_response':
                                    # 处理中间步骤响应
                                    try:
                                        step_response = f"data: {json.dumps({'step_response': response_data})}\n\n"
                                        yield step_response
                                    except Exception as e:
                                        print(f"步骤响应序列化错误: {str(e)}")
                                
                                elif response_type == 'tool_final_response':
                                    # 处理最终响应
                                    try:
                                        final_response = f"data: {json.dumps({'final_response': response_data})}\n\n"
                                        yield final_response
                                        
                                        # 打印工具执行结果
                                        print(f"\n===== 工具执行结果 =====")
                                        print(f"工具: {tool_name}")
                                        print(f"参数: {tool_args}")
                                        print(f"状态: {response_data.get('status', 'unknown')}")
                                        print(f"显示文本: {response_data.get('display_text', '')}")
                                        print(f"结果数据: {response_data.get('result', {})}")
                                        print("======================\n")
                                        
                                        # 格式化工具响应，以便添加到历史记录
                                        formatted_results = format_tool_results([response_data])
                                        # 添加统一格式的消息到历史记录
                                        tool_response_messages.extend(formatted_results)
                                    except Exception as e:
                                        print(f"最终响应序列化错误: {str(e)}")
                                        
                                        
                    # 安全地记录日志，避免空值
                    if reasoning_content is not None:
                        print(f"reasoning_content: {reasoning_content}")
                    if content is not None:
                        print(f"content: {content}")
                except Exception as e:
                    print(f"处理流式响应chunk时出错: {str(e)}")
                    print(f"错误详情:\n{traceback.format_exc()}")
                    continue
        else:        
            # 处理常规模式
            for chunk in stream:
                # 保存最后一个chunk
                last_chunk_container["value"] = chunk
                try:
                    # # 调试信息：打印整个chunk
                    # print("\n--- 调试: Stream Chunk ---")
                    # print(f"Chunk类型: {type(chunk)}")
                    # print(f"Chunk内容: {chunk}")
                    
                    # 检查是否有工具调用
                    if hasattr(chunk.choices[0].delta, 'tool_calls') and chunk.choices[0].delta.tool_calls:
                        print("\n!!! 发现工具调用 !!!")
                        print(f"tool_calls: {chunk.choices[0].delta.tool_calls}")
                        
                        # 处理工具调用（仅记录，暂不执行）
                        for tc in chunk.choices[0].delta.tool_calls:
                            tool_id = tc.id if hasattr(tc, 'id') else None
                            tool_index = tc.index if hasattr(tc, 'index') else 0
                            print(f"  工具ID: {tool_id}, 索引: {tool_index}")
                            
                            if hasattr(tc, 'function'):
                                func_name = tc.function.name if hasattr(tc.function, 'name') else None
                                func_args = tc.function.arguments if hasattr(tc.function, 'arguments') else None
                                print(f"  函数名: {func_name}")
                                print(f"  函数参数: {func_args}")
                            
                            # 工具调用数据收集
                            if tool_id:
                                # 查找现有工具调用记录
                                existing_call = next((t for t in tool_calls_data if t.get('id') == tool_id), None)
                                
                                if not existing_call:
                                    # 新建工具调用记录
                                    tool_call_data = {
                                        'id': tool_id,
                                        'index': tool_index,
                                        'function': {
                                            'name': func_name,
                                            'arguments': ''
                                        }
                                    }
                                    tool_calls_data.append(tool_call_data)
                                    current_tool_call = tool_call_data
                                    print(f"创建新工具调用记录: {tool_call_data}")
                                else:
                                    current_tool_call = existing_call
                                
                                # 累积函数参数
                                if func_args and current_tool_call:
                                    current_tool_call['function']['arguments'] += func_args
                                    print(f"累积参数: {current_tool_call['function']['arguments']}")
                            elif tool_index is not None and func_args is not None:
                                # 没有ID但有索引和参数 - 这是DeepSeek和GPT模型的第二个chunk
                                # 查找匹配索引的工具调用
                                existing_call = next((t for t in tool_calls_data if t.get('index') == tool_index), None)
                                
                                if existing_call:
                                    # 找到匹配索引的调用，将参数关联到它
                                    current_tool_call = existing_call
                                    print(f"根据索引{tool_index}找到现有工具调用: {current_tool_call}")
                                    
                                    # 累积函数参数
                                    current_tool_call['function']['arguments'] += func_args
                                    print(f"累积参数: {current_tool_call['function']['arguments']}")
                                else:
                                    # 如果没有任何工具调用记录，创建一个新的
                                    if not tool_calls_data:
                                        new_id = f"auto_generated_id_{tool_index}"
                                        tool_call_data = {
                                            'id': new_id,
                                            'index': tool_index,
                                            'function': {
                                                'name': func_name or 'unknown_function',
                                                'arguments': func_args or ''
                                            }
                                        }
                                        tool_calls_data.append(tool_call_data)
                                        current_tool_call = tool_call_data
                                        print(f"创建没有ID的工具调用记录: {tool_call_data}")
                                    else:
                                        # 如果有其他工具调用但索引不匹配，使用最后一个
                                        current_tool_call = tool_calls_data[-1]
                                        print(f"没有匹配索引，使用最后一个工具调用: {current_tool_call}")
                                        current_tool_call['function']['arguments'] += func_args
                                        print(f"累积参数: {current_tool_call['function']['arguments']}")
                    
                    # 检查是否有内容
                    if hasattr(chunk.choices[0].delta, 'content') and chunk.choices[0].delta.content is not None:
                        content = chunk.choices[0].delta.content
                        accumulated_output.append(content)
                        # 立即发送内容
                        try:
                            response = f"data: {json.dumps({'content': content})}\n\n"
                            yield response
                            # 强制刷新
                            if hasattr(response, 'flush'):
                                response.flush()
                        except Exception as e:
                            print(f"JSON序列化错误: {str(e)}, 内容: {content}")
                            # 尝试使用安全的JSON序列化
                            try:
                                response = f"data: {json.dumps({'content': content}, ensure_ascii=False)}\n\n"
                                yield response
                            except:
                                print("无法序列化内容，跳过")
                    
                    # 检查是否工具调用结束
                    if hasattr(chunk.choices[0], 'finish_reason') and chunk.choices[0].finish_reason == 'tool_calls':
                        print("\n*** 工具调用结束，finish_reason=tool_calls ***")
                        
                        # 执行工具并处理结果
                        for tool_call in tool_calls_data:
                            tool_id = tool_call.get('id')
                            tool_name = tool_call.get('function', {}).get('name')
                            tool_args_str = tool_call.get('function', {}).get('arguments', '{}')
                            
                            print(f"处理工具调用: ID={tool_id}, 名称={tool_name}, 原始参数={tool_args_str}")
                            
                            # 处理空参数情况
                            if not tool_args_str or tool_args_str.strip() == '':
                                tool_args_str = '{}'
                                print(f"参数为空，设置为空对象: {tool_args_str}")
                            
                            try:
                                # 尝试修复可能的JSON格式问题
                                if not tool_args_str.startswith('{'):
                                    tool_args_str = '{' + tool_args_str
                                    print(f"修复参数开始: {tool_args_str}")
                                
                                if not tool_args_str.endswith('}'):
                                    tool_args_str = tool_args_str + '}'
                                    print(f"修复参数结束: {tool_args_str}")
                                
                                # 解析参数
                                tool_args = json.loads(tool_args_str) if isinstance(tool_args_str, str) else tool_args_str
                                print(f"解析后的参数: {tool_args}")
                                
                                # 检查工具名称是否有效
                                if not tool_name:
                                    print(f"警告: 工具名称为空，跳过执行")
                                    continue
                                
                                # 执行工具并处理流式响应
                                for tool_response in process_streaming_tool_call(tool_name, tool_args, tool_id):
                                    response_type = tool_response.get('type')
                                    response_data = tool_response.get('data', {})
                                    
                                    if response_type == 'tool_step_response':
                                        # 处理中间步骤响应
                                        try:
                                            step_response = f"data: {json.dumps({'step_response': response_data})}\n\n"
                                            yield step_response
                                        except Exception as e:
                                            print(f"步骤响应序列化错误: {str(e)}")
                                    
                                    elif response_type == 'tool_final_response':
                                        # 处理最终响应
                                        try:
                                            final_response = f"data: {json.dumps({'final_response': response_data})}\n\n"
                                            yield final_response
                                            
                                            # 打印工具执行结果
                                            print(f"\n===== 工具执行结果 =====")
                                            print(f"工具: {tool_name}")
                                            print(f"参数: {tool_args}")
                                            print(f"状态: {response_data.get('status', 'unknown')}")
                                            print(f"显示文本: {response_data.get('display_text', '')}")
                                            print(f"结果数据: {response_data.get('result', {})}")
                                            print("======================\n")
                                            
                                            # 格式化工具响应，以便添加到历史记录
                                            formatted_results = format_tool_results([response_data])
                                            # 添加统一格式的消息到历史记录
                                            tool_response_messages.extend(formatted_results)
                                        except Exception as e:
                                            print(f"最终响应序列化错误: {str(e)}")
                            except json.JSONDecodeError as e:
                                error_msg = f"工具参数解析错误: {tool_args_str}, 错误: {str(e)}"
                                print(error_msg)
                                continue
                            except Exception as e:
                                print(f"执行工具时发生未知错误: {str(e)}")
                                print(f"错误详情:\n{traceback.format_exc()}")
                                continue
                    
                except Exception as e:
                    print(f"处理流式响应chunk时出错: {str(e)}")
                    print(f"错误详情:\n{traceback.format_exc()}")
                    continue
                    
        # 在常规模式下，添加工具消息调试信息
        if tool_response_messages:
            try:
                # 打印工具消息调试信息
                print("\n===== 发送工具消息到前端 =====")
                print(f"工具消息数量: {len(tool_response_messages)}")
                for idx, msg in enumerate(tool_response_messages):
                    print(f"消息 {idx+1}:")
                    print(f"  类型: {msg.get('type', 'unknown')}")
                    print(f"  工具名称: {msg.get('function', {}).get('name', 'unknown')}")
                    print(f"  显示文本: {msg.get('display_text', 'none')}")
                    print(f"  状态: {msg.get('status', 'unknown')}")
                    if 'result' in msg:
                        print(f"  结果: {msg['result']}")
                print("===========================\n")
                
                # 使用统一的格式返回工具消息
                tool_messages_response = f"data: {json.dumps({'tool_messages': tool_response_messages})}\n\n"
                yield tool_messages_response
            except Exception as e:
                print(f"工具响应消息序列化错误: {str(e)}")
                print(f"错误详情:\n{traceback.format_exc()}")
        
        # 在处理完所有流后，返回最后一个chunk
        return last_chunk_container["value"]
    
    # 创建一个闭包来跟踪最后一个chunk
    last_chunk_ref = [None]
    
    def capturing_generator():
        last_chunk = yield from stream_generator()
        last_chunk_ref[0] = last_chunk
        
    gen = capturing_generator()
    
    # 返回生成器和获取最后一个chunk的函数
    return gen, lambda: last_chunk_ref[0]

def process_google_stream_response(
    stream: Any, 
    accumulated_output: List[str]
) -> Tuple[Generator[str, None, None], Any]:
    """
    处理来自Google API的流式响应数据，并返回一个生成器和最后的响应chunk
    
    Args:
        stream: Google API返回的流式响应对象
        accumulated_output: 用于累积输出内容的列表
        
    Returns:
        Tuple[Generator[str, None, None], Any]: 
            - 生成器，产生格式化为SSE的响应数据
            - 最后一个响应chunk，用于token统计
    """
    def stream_generator():
        # 存储最后一个chunk
        last_chunk_container = {"value": None}
        
        # 存储工具调用数据
        tool_calls_data = []
        
        # 存储工具调用结果，用于添加到历史记录
        tool_response_messages = []
        
        for chunk in stream:
            # 保存最后一个chunk
            last_chunk_container["value"] = chunk
            
            try:
                # 首先检查响应的类型，Gemini的响应是互斥的 - 要么是文本，要么是函数调用

                # 检查是否为函数调用响应
                has_function_call = False
                
                # 用于去重的工具名称集合
                seen_tool_names = set()
                
                # 检查candidates中的function_call
                if hasattr(chunk, 'candidates') and chunk.candidates:
                    for candidate in chunk.candidates:
                        if hasattr(candidate, 'content') and candidate.content:
                            for part in candidate.content.parts:
                                if hasattr(part, 'function_call') and part.function_call is not None:
                                    has_function_call = True
                                    func_call = part.function_call
                                    func_name = func_call.name
                                    
                                    # 检查是否已经处理过这个工具
                                    if func_name in seen_tool_names:
                                        print(f"跳过重复的函数调用: {func_name}")
                                        continue
                                    
                                    seen_tool_names.add(func_name)
                                    print(f"\n!!! Gemini发现函数调用: {func_name} !!!")
                                    
                                    # 收集工具调用数据
                                    tool_call_data = {
                                        'id': func_name,  # Gemini没有id，使用函数名作为id
                                        'function': {
                                            'name': func_name,
                                            'arguments': func_call.args
                                        }
                                    }
                                    tool_calls_data.append(tool_call_data)
                
                # 检查直接的function_calls
                if hasattr(chunk, 'function_calls') and chunk.function_calls is not None:
                    has_function_call = True
                    for func_call in chunk.function_calls:
                        func_name = func_call.name
                        
                        # 检查是否已经处理过这个工具
                        if func_name in seen_tool_names:
                            print(f"跳过重复的并行函数调用: {func_name}")
                            continue
                        
                        seen_tool_names.add(func_name)
                        print(f"\n!!! Gemini发现并行函数调用: {func_name} !!!")
                        
                        # 收集工具调用数据
                        tool_call_data = {
                            'id': func_name,
                            'function': {
                                'name': func_name,
                                'arguments': func_call.args
                            }
                        }
                        tool_calls_data.append(tool_call_data)
                
                # 如果不是函数调用，那么检查文本内容
                if not has_function_call and hasattr(chunk, 'text') and chunk.text:
                    accumulated_output.append(chunk.text)
                    yield f"data: {json.dumps({'content': chunk.text})}\n\n"
                
                # 处理完整的工具调用
                # Gemini的工具调用结束标志可能不同于OpenAI
                # 需要立即执行工具调用，不需要等待finish_reason标志
                if has_function_call and tool_calls_data:
                    print("\n*** Gemini工具调用执行 ***")
                    
                    # 执行所有收集到的工具
                    for tool_call in tool_calls_data:
                        tool_id = tool_call.get('id')
                        tool_name = tool_call.get('function', {}).get('name')
                        tool_args = tool_call.get('function', {}).get('arguments', {})
                        
                        # 执行工具并处理流式响应
                        for tool_response in process_streaming_tool_call(tool_name, tool_args, tool_id):
                            response_type = tool_response.get('type')
                            response_data = tool_response.get('data', {})
                            
                            if response_type == 'tool_step_response':
                                # 处理中间步骤响应
                                try:
                                    step_response = f"data: {json.dumps({'step_response': response_data})}\n\n"
                                    yield step_response
                                except Exception as e:
                                    print(f"步骤响应序列化错误: {str(e)}")
                            
                            elif response_type == 'tool_final_response':
                                # 处理最终响应
                                try:
                                    final_response = f"data: {json.dumps({'final_response': response_data})}\n\n"
                                    yield final_response
                                    
                                    # 打印工具执行结果
                                    print(f"\n===== 工具执行结果 =====")
                                    print(f"工具: {tool_name}")
                                    print(f"参数: {tool_args}")
                                    print(f"状态: {response_data.get('status', 'unknown')}")
                                    print(f"显示文本: {response_data.get('display_text', '')}")
                                    print(f"结果数据: {response_data.get('result', {})}")
                                    print("======================\n")
                                    
                                    # 格式化工具响应，以便添加到历史记录
                                    formatted_results = format_tool_results([response_data])
                                    # 添加统一格式的消息到历史记录
                                    tool_response_messages.extend(formatted_results)
                                except Exception as e:
                                    print(f"最终响应序列化错误: {str(e)}")
                    
                    # 清空工具调用数据，防止重复执行
                    tool_calls_data = []
            
            except Exception as e:
                print(f"处理Gemini流式响应chunk时出错: {str(e)}")
                print(f"错误详情:\n{traceback.format_exc()}")
                continue
        
        # 在Google模式中，在发送工具消息前添加调试信息
        # 如果有工具响应消息，则作为特殊类型发送
        if tool_response_messages:
            try:
                # 打印工具消息调试信息
                print("\n===== 发送工具消息到前端 =====")
                print(f"工具消息数量: {len(tool_response_messages)}")
                for idx, msg in enumerate(tool_response_messages):
                    print(f"消息 {idx+1}:")
                    print(f"  类型: {msg.get('type', 'unknown')}")
                    print(f"  工具名称: {msg.get('function', {}).get('name', 'unknown')}")
                    print(f"  显示文本: {msg.get('display_text', 'none')}")
                    print(f"  状态: {msg.get('status', 'unknown')}")
                    if 'result' in msg:
                        print(f"  结果: {msg['result']}")
                print("===========================\n")
                
                # 使用统一的格式返回工具消息
                tool_messages_response = f"data: {json.dumps({'tool_messages': tool_response_messages})}\n\n"
                yield tool_messages_response
            except Exception as e:
                print(f"工具响应消息序列化错误: {str(e)}")
                print(f"错误详情:\n{traceback.format_exc()}")
        
        return last_chunk_container["value"]
    
    # 创建闭包来跟踪最后一个chunk
    last_chunk_ref = [None]
    
    def capturing_generator():
        last_chunk = yield from stream_generator()
        last_chunk_ref[0] = last_chunk
    
    gen = capturing_generator()
    
    # 返回生成器和获取最后一个chunk的函数
    return gen, lambda: last_chunk_ref[0] 
