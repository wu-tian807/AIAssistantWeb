import inspect
import json
import functools
from typing import Dict, List, Callable, Optional, Any

# 存储所有注册的工具
registered_tools: Dict[str, Dict[str, Any]] = {}

def tool_decorator(name: Optional[str] = None, 
                  description: Optional[str] = None,
                  parameters: Optional[Dict] = None,
                  strict: bool = True):
    """
    工具函数装饰器，用于将函数注册为LLM可调用的工具。
    
    Args:
        name: 工具名称，默认使用函数名
        description: 工具描述，默认使用函数的docstring
        parameters: 工具参数定义，默认从函数签名和docstring解析
        strict: 是否启用严格模式验证参数
    """
    def decorator(func: Callable):
        func_name = name or func.__name__
        func_doc = func.__doc__ or ""
        
        # 获取函数参数信息
        sig = inspect.signature(func)
        
        # 如果未提供参数定义，则从函数签名生成
        if parameters is None:
            param_properties = {}
            required_params = []
            
            for param_name, param in sig.parameters.items():
                if param_name == 'self' or param_name == 'cls':
                    continue
                    
                # 改进类型推断
                param_type = "string"  # 默认类型
                
                # 检查参数的类型注解
                if param.annotation != inspect.Parameter.empty:
                    # 处理基本类型
                    if param.annotation == bool:
                        param_type = "boolean"
                    elif param.annotation in (int, float):
                        param_type = "number"
                    elif param.annotation == list or str(param.annotation).startswith("typing.List"):
                        param_type = "array"
                    # 可以根据需要添加更多类型
                
                # 检查参数的默认值类型
                if param.default != inspect.Parameter.empty:
                    if isinstance(param.default, bool):
                        param_type = "boolean"
                    elif isinstance(param.default, (int, float)):
                        param_type = "number"
                    elif isinstance(param.default, list):
                        param_type = "array"
                    
                param_properties[param_name] = {
                    "type": param_type,  # 使用推断的类型
                    "description": f"参数 {param_name}"  # 默认描述
                }
                
                # 如果参数没有默认值且不是可变参数，则为必需参数
                if param.default == inspect.Parameter.empty and param.kind not in (
                    inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD):
                    required_params.append(param_name)
            
            # 从docstring中提取参数描述（可进一步完善）
            # 这里简单处理，实际应用中可能需要更复杂的docstring解析
            
            tool_parameters = {
                "type": "object",
                "properties": param_properties,
                "required": required_params,
                "additionalProperties": False
            }
        else:
            tool_parameters = parameters
        
        # 注册工具 - 统一使用OpenAI格式
        tool_definition = {
            "function_impl": func,  # 存储实际函数引用
            "tool_info": {
                "type": "function",
                "function": {
                    "name": func_name,
                    "description": description or func_doc.strip(),
                    "parameters": tool_parameters
                }
            }
        }
        
        registered_tools[func_name] = tool_definition
        
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)
        
        return wrapper
    
    return decorator

def get_registered_tools() -> List[Dict]:
    """
    获取所有注册的工具定义，用于传递给LLM
    
    Returns:
        工具定义列表(不包含实际函数引用)
    """
    tools = []
    for name, tool in registered_tools.items():
        # 只返回工具信息，不包含函数实现
        tools.append(tool["tool_info"])
    return tools

def execute_tool(tool_name: str, arguments: Dict) -> Any:
    """
    执行指定的工具函数
    
    Args:
        tool_name: 工具名称
        arguments: 传递给工具的参数字典
    
    Returns:
        工具函数的执行结果
    """
    if tool_name not in registered_tools:
        raise ValueError(f"工具 {tool_name} 未注册")
    
    tool = registered_tools[tool_name]
    func = tool['function_impl']
    
    # 调用工具函数并返回结果
    return func(**arguments)
