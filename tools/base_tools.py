import datetime
import json
from typing import Dict, Any, Union, Generator
from utils.tool_wrapper import tool_decorator

@tool_decorator()
def get_current_time(format: str = "%Y-%m-%d %H:%M:%S", timezone: str = "UTC") -> Dict[str, Any]:
    """
    获取当前服务器时间并按指定格式返回。
    
    Args:
        format: 返回的时间格式，默认为"%Y-%m-%d %H:%M:%S"
        timezone: 时区，默认为"UTC"。未来可支持更多时区。
    
    Returns:
        包含格式化时间信息的字典
    """
    # 目前仅支持UTC和本地时间
    current_time = datetime.datetime.now()
    if timezone.lower() == "local":
        pass  # 已经是本地时间了
    elif timezone.lower() == "utc":
        current_time = datetime.datetime.utcnow()
    else:
        # 未来可以添加更多时区支持
        pass
    
    # 格式化时间并返回
    time_result = {
        "current_time": current_time.strftime(format),
        "timezone": timezone
    }
    
    # 构建统一的响应格式
    return {
        "final_response": {
            "result": time_result,
            "display_text": f"当前{timezone}时间是: {current_time.strftime(format)}",
            "status": "success"
        }
    }

@tool_decorator()
def get_date_info(date: str = None) -> Dict[str, Any]:
    """
    获取指定日期的详细信息，如果不指定日期则使用当前日期。
    
    Args:
        date: 日期字符串，格式为"YYYY-MM-DD"，默认为当前日期
    
    Returns:
        包含日期详细信息的字典
    """
    error = None
    date_result = None
    
    try:
        if date:
            try:
                # 尝试解析用户提供的日期
                parsed_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
            except ValueError:
                error = "日期格式错误，请使用YYYY-MM-DD格式"
                return {
                    "final_response": {
                        "result": {"error": error},
                        "display_text": error,
                        "status": "error"
                    }
                }
        else:
            # 使用当前日期
            parsed_date = datetime.date.today()
        
        # 计算星期几
        weekday_names = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
        weekday = weekday_names[parsed_date.weekday()]
        
        # 计算是一年中的第几天
        day_of_year = parsed_date.timetuple().tm_yday
        
        # 计算该年总天数
        year = parsed_date.year
        is_leap_year = (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
        days_in_year = 366 if is_leap_year else 365
        
        date_result = {
            "date": parsed_date.strftime("%Y-%m-%d"),
            "year": parsed_date.year,
            "month": parsed_date.month,
            "day": parsed_date.day,
            "weekday": weekday,
            "day_of_year": day_of_year,
            "days_in_year": days_in_year,
            "is_leap_year": is_leap_year
        }
        
        # 构建用户友好的显示文本
        date_str = parsed_date.strftime("%Y年%m月%d日")
        display_text = (
            f"日期信息 - {date_str} ({weekday})\n"
            f"这是{year}年的第{day_of_year}天，今年共有{days_in_year}天。"
        )
        if is_leap_year:
            display_text += f"\n{year}年是闰年。"
        
        return {
            "final_response": {
                "result": date_result,
                "display_text": display_text,
                "status": "success"
            }
        }
        
    except Exception as e:
        error = f"获取日期信息时出错: {str(e)}"
        return {
            "final_response": {
                "result": {"error": error},
                "display_text": error,
                "status": "error"
            }
        }

# 示例：带有step_response的异步工具函数模板
"""
@tool_decorator()
def async_long_task(param1: str, param2: int) -> Generator[Dict[str, Any], None, None]:
    '''
    执行一个需要分步骤返回结果的长任务
    
    Args:
        param1: 第一个参数
        param2: 第二个参数
        
    Yields:
        字典，包含step_response或final_response
    '''
    # 第一步
    yield {
        "step_response": {
            "step": 1,
            "message": "任务已开始...",
            "progress": 0
        }
    }
    
    # 模拟处理时间
    # time.sleep(1)
    
    # 第二步
    yield {
        "step_response": {
            "step": 2,
            "message": "正在处理数据...",
            "progress": 50
        }
    }
    
    # 模拟处理时间
    # time.sleep(1)
    
    # 最终结果
    yield {
        "final_response": {
            "result": {"param1": param1, "param2": param2, "computed_value": param2 * 2},
            "display_text": f"任务完成! 参数 {param1} 和 {param2} 处理结果: {param2 * 2}",
            "status": "success"
        }
    }
""" 