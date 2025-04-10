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

def convert_tools_for_google(tools=None, messages=None) -> Dict:
    """
    将统一格式的工具定义和消息转换为Google支持的格式
    
    重要：此函数假设输入的tools和messages已经是统一格式。
    统一格式的工具消息应该符合以下结构：
    [
        {
            'role': 'tool',
            'type': 'function',
            'function': {
                'name': '工具名称',
                'response': {...}  // 工具响应数据
            },
            'status': 'success',   // 或 'error'
            'tool_call_id': '...'  // 原始工具调用ID
            'display_text': '...'  // 用于前端显示的文本
            'result': {...}        // 原始结果数据
        },
        {
            'role': 'tool',
            'type': 'function',
            ...
        }
    ]
    方法：
    1.工具结果存放toolResult字段
    2.toolResult存放在assistant.tool_result中
    Args:
        tools: 统一格式的工具列表，可以为None
        messages: 统一格式的消息列表，可以为None
        
    Returns:
        Dict: 包含转换后工具配置和消息的字典
    """
    result = {}
    
    # 处理工具定义转换
    if tools:
        # 导入Google Gemini的types模块
        from google.genai import types
        import copy
        import json
        
        function_declarations = []
        
        for tool in tools:
            if 'function' not in tool:
                continue
                
            # 获取统一格式的函数定义
            function_def = tool['function']
            
            # 深度复制parameters对象
            parameters = copy.deepcopy(function_def.get('parameters', {}))
            
            # 移除Gemini不支持的属性
            if 'additionalProperties' in parameters:
                parameters.pop('additionalProperties')
            
            # 处理properties中的每个属性，移除不兼容的字段
            if 'properties' in parameters:
                for prop_name, prop_value in parameters['properties'].items():
                    if isinstance(prop_value, dict):
                        # 移除每个属性中可能存在的additionalProperties
                        if 'additionalProperties' in prop_value:
                            prop_value.pop('additionalProperties')
            
            try:
                # 使用Gemini API的类型构造函数声明
                name = function_def.get('name', '')
                description = function_def.get('description', '')
                
                # 先将参数转换为JSON字符串，再解析回来，确保完全兼容
                parameters_json = json.dumps(parameters)
                clean_parameters = json.loads(parameters_json)
                
                # 使用FunctionDeclaration构造函数声明
                function_declaration = types.FunctionDeclaration(
                    name=name,
                    description=description,
                    parameters=clean_parameters
                )
                
                function_declarations.append(function_declaration)
            except Exception as e:
                print(f"构造函数声明时出错: {str(e)}")
                print(f"问题函数: {function_def.get('name', '')}")
                print(f"参数: {parameters}")
                continue
        
        # 如果有有效的函数声明，创建工具配置
        if function_declarations:
            gemini_tools = [types.Tool(function_declarations=function_declarations)]
            
            # 创建完整的配置对象
            tool_config = {
                "tools": gemini_tools,
                "tool_config": {"function_calling_config": {"mode": "auto"}},
                "automatic_function_calling": {"disable": False, "maximum_remote_calls": 10}
            }
            
            result["tool_config"] = tool_config
    
    # 处理消息转换
    if messages and isinstance(messages, list):
        import json
        import copy
        from google.genai import types
        
        converted_messages = []
        tool_responses = []
        
        for i, msg in enumerate(messages):
            # 复制消息，避免修改原始消息
            api_msg = copy.deepcopy(msg)
            
            # 跳过system消息，因为system_instruction会单独传递
            if api_msg.get('role') == 'system':
                continue
                
            # 处理assistant消息
            elif api_msg.get('role') == 'model':
                # 提取工具结果
                tool_results = api_msg.get('tool_results', [])
                
                # 处理assistant消息内容
                assistant_content = api_msg.get('content', '')
                # 处理content可能是列表的情况
                if isinstance(assistant_content, list):
                    text_parts = []
                    for item in assistant_content:
                        if isinstance(item, dict) and item.get('type') == 'text':
                            text_parts.append(item.get('text', ''))
                    assistant_content = ''.join(text_parts)
                
                # 创建助手消息部分
                parts = []
                if assistant_content:
                    parts.append(types.Part(text=assistant_content))
                
                # 如果有工具结果，添加函数调用
                for tool_result in tool_results:
                    tool_name = tool_result.get('function', {}).get('name') or tool_result.get('tool_name', '')
                    
                    # 获取工具响应数据
                    result_data = {}
                    if 'result' in tool_result:
                        result_data = tool_result['result']
                    elif 'function' in tool_result and 'response' in tool_result['function']:
                        result_data = tool_result['function']['response']
                    
                    # 创建函数调用对象
                    function_call = types.FunctionCall(
                        name=tool_name,
                        args=result_data  # 使用适当的参数
                    )
                    
                    # 添加函数调用部分
                    func_part = types.Part(function_call=function_call)
                    parts.append(func_part)
                    
                    # 创建函数响应并存储，稍后添加
                    tool_responses.append({
                        'name': tool_name,
                        'response': {'result': result_data},
                        'tool_call_id': tool_result.get('tool_call_id', '')
                    })
                
                # 添加助手消息（如果有内容）
                if parts:
                    assistant_msg = types.Content(
                        role='model',
                        parts=parts
                    )
                    converted_messages.append(assistant_msg)
                    
                    # 添加工具响应作为后续的用户消息
                    for tool_resp in tool_responses:
                        # 创建函数响应部分
                        function_response = types.Part.from_function_response(
                            name=tool_resp['name'],
                            response={'result': tool_resp['response']['result']}
                        )
                        user_content = types.Content(
                            role='user', 
                            parts=[function_response]
                        )
                        converted_messages.append(user_content)
                    
                    # 清空工具响应列表，防止重复添加
                    tool_responses = []
            
            # 处理用户消息
            elif api_msg.get('role') == 'user':
                user_content = api_msg.get('content', '')
                # 处理content可能是列表的情况
                if isinstance(user_content, list):
                    text_parts = []
                    for item in user_content:
                        if isinstance(item, dict) and item.get('type') == 'text':
                            text_parts.append(item.get('text', ''))
                    user_content = ''.join(text_parts)
                
                # 添加用户消息
                user_msg = types.Content(
                    role='user',
                    parts=[types.Part(text=user_content)]
                )
                converted_messages.append(user_msg)
        
        result["converted_messages"] = converted_messages
    
    return result

def convert_tools_for_openai(tools=None, messages=None) -> Dict:
    """
    将统一格式的工具定义和消息转换为OpenAI支持的格式
    
    重要：此函数假设输入的tools和messages已经是统一格式。
    统一格式的工具消息应该符合以下结构：
    [
        {
            'role': 'tool',
            'type': 'function',
            'function': {
                'name': '工具名称',
                'response': {...}  // 工具响应数据
            },
            'status': 'success',   // 或 'error'
            'tool_call_id': '...'  // 原始工具调用ID
            'display_text': '...'  // 用于前端显示的文本
            'result': {...}        // 原始结果数据
        },
        {
            'role': 'tool',
            'type': 'function',
            ...
        }
    ]
    方法：
    1.工具结果存放toolResult字段
    2.toolResult存放在assistant.tool_result中
    Args:
        tools: 统一格式的工具列表，可以为None
        messages: 统一格式的消息列表，可以为None
        
    Returns:
        Dict: 包含转换后工具配置和消息的字典
    """
    result = {}
    
    # 处理工具定义转换
    if tools:
        import copy
        
        # 深度复制以避免修改原始数据
        openai_tools = copy.deepcopy(tools)
        
        # 验证每个工具是否符合OpenAI的格式要求
        validated_tools = []
        for tool in openai_tools:
            # 确保有function字段
            if 'function' in tool:
                # 确保function有name字段
                function = tool['function']
                if 'name' in function:
                    validated_tools.append(tool)
                else:
                    print(f"警告: 跳过缺少name字段的工具")
            else:
                print(f"警告: 跳过缺少function字段的工具")
        
        # 如果有有效的工具，创建配置
        if validated_tools:
            tool_config = {
                "tools": validated_tools,
                "tool_choice": "auto"  # 使用auto模式选择工具
            }
            
            result["tool_config"] = tool_config
    
    # 处理消息转换
    if messages and isinstance(messages, list):
        import json
        import copy
        
        converted_messages = []
        
        for msg in messages:
            # 复制消息，避免修改原始消息
            api_msg = copy.deepcopy(msg)
            
            # # 检查是否为统一格式的工具消息
            # if api_msg.get('type') == 'function' and 'function' in api_msg:
            #     # 转换为OpenAI的工具消息格式
            #     tool_response = {
            #         'role': 'tool',  # OpenAI官方推荐使用'tool'角色，不再使用'function'
            #         'tool_call_id': api_msg.get('tool_call_id', ''),
            #         'name': api_msg['function'].get('name', ''),
            #     }
                
            #     # 使用result作为content
            #     if 'result' in api_msg:
            #         # 将结果转换为字符串
            #         if isinstance(api_msg['result'], dict):
            #             tool_response['content'] = json.dumps(api_msg['result'])
            #         else:
            #             tool_response['content'] = str(api_msg['result'])
            #     # 如果没有result，则使用display_text
            #     elif 'display_text' in api_msg and api_msg['display_text']:
            #         tool_response['content'] = api_msg['display_text']
            #     # 最后才考虑使用function.response
            #     else:
            #         tool_response['content'] = json.dumps(api_msg['function'].get('response', {}))
                
            #     converted_messages.append(tool_response)
            # else:
            #     # 保留其他类型的消息
            #     converted_messages.append(api_msg)
            # 从助手消息中拿到tool_results参数
            if api_msg.get('role') == 'assistant':
                print('assistant信息',api_msg)
                tool_results = api_msg.get('tool_results', [])
                if tool_results:
                    for tool_result in tool_results:
                        #转换tool_result为openai的工具消息格式
                        tool_response = {
                            'role': 'tool',
                            'tool_call_id': tool_result.get('tool_call_id'),
                            'name': tool_result.get('name')
                        }
                        # 使用result作为content
                        if 'result' in tool_result:
                            tool_response['content'] = json.dumps(tool_result['result'])
                        else:
                            tool_response['content'] = tool_result.get('display_text', '')
                        converted_messages.append(tool_response)
                    # 添加助手消息本体
                    assistant_content = api_msg.get('content', '已调用工具信息')
                    # 处理content可能是列表的情况
                    if isinstance(assistant_content, list):
                        text_parts = []
                        for item in assistant_content:
                            if isinstance(item, dict) and item.get('type') == 'text':
                                text_parts.append(item.get('text', ''))
                        assistant_content = ''.join(text_parts)
                    
                    assistant_msg = {
                        'role': 'assistant',
                        'content': assistant_content
                    }
                    converted_messages.append(assistant_msg)
                else:
                    # 即使没有工具结果也添加助手消息
                    assistant_content = api_msg.get('content', '')
                    # 处理content可能是列表的情况
                    if isinstance(assistant_content, list):
                        text_parts = []
                        for item in assistant_content:
                            if isinstance(item, dict) and item.get('type') == 'text':
                                text_parts.append(item.get('text', ''))
                        assistant_content = ''.join(text_parts)
                    
                    assistant_msg = {
                        'role': 'assistant',
                        'content': assistant_content
                    }
                    converted_messages.append(assistant_msg)
            else:
                converted_messages.append(api_msg)
        
        result["converted_messages"] = converted_messages
    
    return result

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

def format_tool_results(tool_results: List[Dict]) -> List[Dict]:
    """
    将工具结果格式化为统一格式的消息列表
    
    统一格式说明:
    {
        'type': 'function',
        'function': {
            'name': '工具名称',
            'response': {...}  // 工具响应数据
        },
        'status': 'success',   // 或 'error'
        'tool_call_id': '...'  // 原始工具调用ID
        'display_text': '...'  // 用于前端显示的文本
        'result': {...}        // 原始结果数据，用于历史记录
    }
    
    Args:
        tool_results: 工具调用结果列表
        
    Returns:
        List[Dict]: 统一格式的工具消息列表
    """
    unified_messages = []
    
    for result in tool_results:
        tool_call_id = result.get('tool_call_id')
        tool_name = result.get('tool_name')
        status = result.get('status', 'success')
        display_text = result.get('display_text', '')
        
        # 提取结果内容
        if status == 'success':
            result_data = result.get('result', {})
        else:
            # 错误结果
            result_data = {
                'error': result.get('error', '未知错误'),
                'error_type': result.get('error_type', 'UnknownError')
            }
        
        # 统一格式 - 使用与工具定义一致的格式
        unified_message = {
            'type': 'function',
            'function': {
                'name': tool_name,
                'response': result_data
            },
            'status': status,
            'tool_call_id': tool_call_id,
            'display_text': display_text,  # 保留display_text
            'result': result_data          # 保留原始结果数据
        }
        unified_messages.append(unified_message)
    
    return unified_messages

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