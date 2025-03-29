import json
from typing import Dict, List, Any, Optional, Generator, Union
from utils.tool_wrapper import get_registered_tools, execute_tool

def get_all_tools_name() -> List[str]:
    """
    获取所有工具的名称
    
    Returns:
        List[str]: 所有工具的名称列表
    """
    tools = get_registered_tools()
    return [tool['function']['name'] for tool in tools]

def get_tools(enable_tools: bool = True, selected_tools: List[str] = None) -> List[Dict]:
    """
    获取可用的工具列表，根据用户设置和工具选择进行过滤
    
    Args:
        enable_tools: 是否启用工具调用功能
        selected_tools: 用户选择的工具列表，为空则返回所有工具
        
    Returns:
        符合条件的工具列表
    """
    if not enable_tools:
        return []
    
    # 获取所有已注册的工具
    all_tools = get_registered_tools()
    
    # 如果未指定特定工具，则返回所有工具
    if not selected_tools:
        return all_tools
    
    # 过滤出用户选择的工具
    filtered_tools = []
    for tool in all_tools:
        if 'function' in tool and tool['function']['name'] in selected_tools:
            filtered_tools.append(tool)
    
    return filtered_tools

def process_tool_call(tool_name: str, tool_args: Dict) -> tuple[Union[Dict, Generator[Dict, None, None]], bool]:
    """
    处理单个工具调用，支持同步和异步工具
    
    Args:
        tool_name: 工具名称
        tool_args: 工具参数
        
    Returns:
        元组: (工具执行结果或生成器, 是否为迭代器)
    """
    try:
        # 执行工具调用
        result = execute_tool(tool_name, tool_args)
        
        # 检查结果是否是生成器（异步工具）
        is_iterator = hasattr(result, '__iter__') and not isinstance(result, (dict, list, str))
        
        if is_iterator:
            return result, True  # 返回生成器，由调用者处理step_response
        
        # 所有工具都应该返回统一格式
        if not isinstance(result, dict) or ('final_response' not in result and 'step_response' not in result):
            raise ValueError(f"工具 {tool_name} 返回的结果格式不正确，应该包含 final_response 或 step_response 字段")
            
        return result, False
    except Exception as e:
        # 处理工具调用错误
        error_msg = str(e)
        return {
            'final_response': {
                'result': {
                    'error': error_msg,
                    'error_type': type(e).__name__
                },
                'display_text': f"执行工具 {tool_name} 时出错: {error_msg}",
                'status': 'error'
            }
        }, False

def handle_tool_calls(tool_calls: List[Dict]) -> List[Dict]:
    """
    处理一批工具调用
    
    Args:
        tool_calls: 工具调用列表，每个元素包含id、name和arguments
        
    Returns:
        工具调用结果列表
    """
    results = []
    
    for tool_call in tool_calls:
        tool_id = tool_call.get('id')
        # 支持不同API格式的工具调用
        tool_name = tool_call.get('name', tool_call.get('function', {}).get('name'))
        arguments_str = tool_call.get('arguments', 
                                    tool_call.get('function', {}).get('arguments', '{}'))
        
        # 如果没有工具名称，跳过
        if not tool_name:
            results.append({
                'tool_call_id': tool_id,
                'status': 'error',
                'error': "缺少工具名称",
                'error_type': 'InvalidToolCall',
                'display_text': "无效的工具调用：缺少工具名称"
            })
            continue
        
        # 解析参数
        try:
            arguments = json.loads(arguments_str) if isinstance(arguments_str, str) else arguments_str
        except json.JSONDecodeError:
            results.append({
                'tool_call_id': tool_id,
                'status': 'error',
                'error': f"无法解析参数: {arguments_str}",
                'error_type': 'JSONDecodeError',
                'display_text': f"工具参数格式错误: {arguments_str}"
            })
            continue
            
        # 执行工具
        tool_result, is_iterator = process_tool_call(tool_name, arguments)
        
        # 处理生成器结果（异步工具）
        if is_iterator:
            # 这里只处理final_response，step_response由外部处理
            for response in tool_result:
                if isinstance(response, dict) and 'final_response' in response:
                    final_response = response['final_response']
                    final_response['tool_call_id'] = tool_id
                    final_response['tool_name'] = tool_name
                    results.append(final_response)
                    break
        else:
            # 处理同步工具结果
            final_response = tool_result['final_response']
            final_response['tool_call_id'] = tool_id
            final_response['tool_name'] = tool_name
            results.append(final_response)
    
    return results

def format_tool_results(tool_results: List[Dict]) -> Dict:
    """
    将工具结果格式化为不同API类型可用的格式
    
    Args:
        tool_results: 工具调用结果列表
        
    Returns:
        Dict: 包含OpenAI和Google格式的工具结果
    """
    openai_messages = []
    google_messages = []
    display_texts = []
    
    for result in tool_results:
        tool_call_id = result.get('tool_call_id')
        tool_name = result.get('tool_name')
        status = result.get('status', 'success')
        display_text = result.get('display_text', '')
        display_texts.append(display_text)
        
        # 提取结果内容
        if status == 'success':
            result_data = result.get('result', {})
            # 为OpenAI格式创建JSON字符串
            content = json.dumps(result_data)
        else:
            # 错误结果
            error_info = {
                'error': result.get('error', '未知错误'),
                'error_type': result.get('error_type', 'UnknownError')
            }
            result_data = error_info
            content = json.dumps(error_info)
        
        # OpenAI格式
        openai_message = {
            'role': 'tool',
            'tool_call_id': tool_call_id,
            'name': tool_name,
            'content': content
        }
        openai_messages.append(openai_message)
        
        # Google格式
        google_message = {
            'function_response': {
                'name': tool_name,
                'response': result_data
            },
            'tool_call_id': tool_call_id,
            'role': 'function'  # Google使用'function'角色表示工具响应
        }
        google_messages.append(google_message)
    
    return {
        'openai': openai_messages,
        'google': google_messages,
        'display_texts': display_texts,
        'raw': tool_results
    }

def format_step_response(step_response: Dict, tool_call_id: str, tool_name: str) -> Dict:
    """
    格式化步骤响应，用于实时反馈
    
    Args:
        step_response: 步骤响应
        tool_call_id: 工具调用ID
        tool_name: 工具名称
        
    Returns:
        格式化的步骤响应
    """
    step_response.update({
        'tool_call_id': tool_call_id,
        'tool_name': tool_name
    })
    
    return {
        'type': 'tool_step_response',
        'data': step_response
    }

def process_streaming_tool_call(tool_name: str, tool_args: Dict, tool_id: str) -> Generator[Dict, None, None]:
    """
    处理流式工具调用，实时返回每一步结果
    
    Args:
        tool_name: 工具名称
        tool_args: 工具参数
        tool_id: 工具调用ID
        
    Yields:
        Dict: 包含工具执行过程和结果的字典
    """
    try:
        # 执行工具
        tool_result, is_iterator = process_tool_call(tool_name, tool_args)
        
        if is_iterator:
            # 处理异步工具的中间步骤
            for response in tool_result:
                if 'step_response' in response:
                    step_response = response['step_response']
                    formatted_response = format_step_response(step_response, tool_id, tool_name)
                    yield formatted_response
                elif 'final_response' in response:
                    final_response = response['final_response']
                    final_response['tool_call_id'] = tool_id
                    final_response['tool_name'] = tool_name
                    yield {
                        'type': 'tool_final_response',
                        'data': final_response
                    }
        else:
            # 处理同步工具结果
            final_response = tool_result['final_response']
            final_response['tool_call_id'] = tool_id
            final_response['tool_name'] = tool_name
            yield {
                'type': 'tool_final_response',
                'data': final_response
            }
    except Exception as e:
        # 处理异常
        error_response = {
            'tool_call_id': tool_id,
            'tool_name': tool_name,
            'status': 'error',
            'error': str(e),
            'error_type': type(e).__name__,
            'display_text': f"执行工具 {tool_name} 时出错: {str(e)}"
        }
        yield {
            'type': 'tool_final_response',
            'data': error_response
        } 