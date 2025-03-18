from google.genai import Client
from openai.types.chat.chat_completion import ChatCompletion
from typing import Union, Dict, Any
import json
import random
from initialization import xai_client

def evaluate_text_type(text: str,max_retry:int=3):
    client = xai_client
    
    # 处理过长文本，抽样中间部分进行分析
    MAX_SAMPLE_LENGTH = 2000
    if len(text) > MAX_SAMPLE_LENGTH:
        # 随机抽取开头、中间和结尾部分
        start_sample = text[:500]
        mid_start = random.randint(0, len(text) - 1000)
        mid_sample = text[mid_start:mid_start+1000]
        end_sample = text[-500:]
        sample_text = f"{start_sample}\n...\n{mid_sample}\n...\n{end_sample}"
    else:
        sample_text = text
    
    # 构建系统提示
    system_prompt = """你是一个专业的文本分析专家。你的任务是分析给定文本的类型和专业度，并提供自动换行建议。

请分析以下几个方面：
1. 文本类型及建议换行长度：
   - 代码：0（不自动换行，代码需要保持原有格式）
   - 技术文档：80-100（保持适当的宽度便于阅读）
   - 学术论文：60-80（较短的行有助于专注阅读）
   - 普通文章：100-120（中等宽度适合普通阅读）
   - 散文/随笔：120-150（较长的行有助于流畅阅读）
   - 创意文学：100-120（平衡艺术性和可读性）

2. 专业度/创意性评分（0.0-1.0）：
   - 接近1.0：高度创意性、艺术性文本（诗歌、创意散文等）
   - 0.6-0.9：普通文学作品、生活随笔
   - 0.3-0.6：普通文章、技术文档
   - 0.0-0.3：学术论文、程序代码等高专业性内容

请以JSON格式返回以下字段：
{
  "type": "文本类型",
  "line_length": 数字（0表示不自动换行）,
  "creativity_score": 0.0到1.0之间的小数,
  "type_reason": "判断文本类型的理由",
  "creativity_reason": "判断专业度/创意性的理由"
}"""
    
    if max_retry <= 0:
        raise Exception("文本类型分析失败，持续性的缺失参数或返回错误范围")
    # 调用大模型进行评估
    try:
        response = client.chat.completions.create(
            model="grok-2-latest",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"请分析以下文本:\n\n{sample_text}"}
            ],
            response_format={"type": "json_object"}
        )
        
        result_text = response.choices[0].message.content
        
        # 解析结果并验证JSON完整性
        flag = True
        try:
            result = json.loads(result_text)
            required_fields = ["type", "line_length", "creativity_score", "type_reason", "creativity_reason"]
            
            # 检查所有字段是否存在
            missing_fields = [field for field in required_fields if field not in result]
            if missing_fields:
                print(f"缺少字段: {missing_fields}，重试中...")
                return evaluate_text_type(text, client,max_retry-1)  # 递归重试
                
            # 验证数值范围
            if not isinstance(result["line_length"], (int, float)) or result["line_length"] < 0:
                result["line_length"] = 100  # 默认值
                print("line_length 默认值")
                flag = False
                
            if not isinstance(result["creativity_score"], (int, float)) or not (0 <= result["creativity_score"] <= 1):
                result["creativity_score"] = 0.5  # 默认值
                print("creativity_score 默认值")
                flag = False
            if flag:
                return result
            else:
                return evaluate_text_type(text, client,max_retry-1)  # 递归重试
            
        except json.JSONDecodeError:
            print("返回格式错误，重试中...")
            return evaluate_text_type(text, client,max_retry-1)  # 递归重试
            
    except Exception as e:
        print(f"调用模型出错: {str(e)}")
        return evaluate_text_type(text,max_retry-1)