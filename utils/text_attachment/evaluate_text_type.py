from google.genai import Client
from openai.types.chat.chat_completion import ChatCompletion
from typing import Union, Dict, Any
import json
import random
import time
from initialization import xai_client

def evaluate_text_type(text: str, max_retry: int = 1):
    """
    优化版的文本类型评估函数
    
    Args:
        text: 文本内容
        max_retry: 重试次数
        
    Returns:
        Dict[str, Any]: 文本类型分析结果
    """
    # 默认返回值，避免API故障时系统崩溃
    default_result = {
        "type": "普通文章",
        "line_length": 100,
        "creativity_score": 0.5,
        "type_reason": "默认分类",
        "creativity_reason": "默认评分"
    }
    
    # 文本太小时直接返回默认值
    if len(text) < 100:
        print("文本太短，使用默认值")
        return default_result
    
    client = xai_client
    
    # 处理过长文本，更高效的抽样策略
    MAX_SAMPLE_LENGTH = 1500  # 减小样本大小，降低API负担
    if len(text) > MAX_SAMPLE_LENGTH:
        # 抽取开头、中间和结尾部分，减小中间样本
        start_sample = text[:400]
        mid_start = len(text) // 2 - 350
        mid_sample = text[mid_start:mid_start+700]
        end_sample = text[-400:]
        sample_text = f"{start_sample}\n...\n{mid_sample}\n...\n{end_sample}"
    else:
        sample_text = text
    
    # 构建系统提示
    system_prompt = """你是一个专业的文本分析专家。你的任务是分析给定文本的类型和专业度，并提供自动换行建议。请简短快速地完成分析。

请分析以下几个方面：
1. 文本类型及建议换行长度：
   - 代码：0（不自动换行）
   - 技术文档：80-100
   - 学术论文：60-80
   - 普通文章：100-120
   - 散文/随笔：120-150
   - 创意文学：100-120

2. 专业度/创意性评分（0.0-1.0）：
   - 接近1.0：高度创意性、艺术性文本
   - 0.6-0.9：普通文学作品、生活随笔
   - 0.3-0.6：普通文章、技术文档
   - 0.0-0.3：学术论文、程序代码等高专业性内容

以JSON格式返回：{"type": "文本类型", "line_length": 数字, "creativity_score": 0.0到1.0, "type_reason": "简短理由", "creativity_reason": "简短理由"}"""
    
    # 使用非递归的重试方式
    for retry in range(max_retry + 1):
        try:
            start_time = time.time()
            print(f"文本分析尝试 #{retry+1}")
            
            # 设置超时
            response = client.chat.completions.create(
                model="grok-2-latest",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"请快速分析以下文本:\n\n{sample_text}"}
                ],
                response_format={"type": "json_object"},
                max_tokens=300  # 限制返回长度，加快响应速度
            )
            
            result_text = response.choices[0].message.content
            process_time = time.time() - start_time
            print(f"Grok API响应时间: {process_time:.2f}秒")
            
            # 解析结果
            try:
                result = json.loads(result_text)
                
                # 验证所需字段是否存在
                required_fields = ["type", "line_length", "creativity_score"]
                missing_fields = [field for field in required_fields if field not in result]
                
                if missing_fields:
                    print(f"缺少字段: {missing_fields}")
                    if retry >= max_retry:
                        # 最后一次重试失败，补充缺失字段
                        for field in missing_fields:
                            result[field] = default_result[field]
                    else:
                        # 继续下一次重试
                        continue
                
                # 验证数值范围并修正
                if not isinstance(result.get("line_length"), (int, float)) or not (0 <= result.get("line_length", 0) <= 200):
                    print("修正行长度为默认值100")
                    result["line_length"] = 100
                
                if not isinstance(result.get("creativity_score"), (int, float)) or not (0 <= result.get("creativity_score", 0) <= 1):
                    print("修正创意度为默认值0.5")
                    result["creativity_score"] = 0.5
                
                return result
                
            except json.JSONDecodeError:
                print(f"JSON解析错误，Grok返回: {result_text[:100]}...")
                if retry >= max_retry:
                    return default_result
                
        except Exception as e:
            print(f"文本类型分析出错 (尝试 {retry+1}/{max_retry+1}): {str(e)}")
            if retry >= max_retry:
                return default_result
            # 短暂休息后重试
            time.sleep(1)
    
    # 所有重试都失败
    print("所有文本分析尝试都失败，使用默认值")
    return default_result