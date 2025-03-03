from initialization import aliyun_client
from utils.chat.picture_describer import DESCIRPTION_PROMPT
#测试是否阿里云出问题了
def test_aliyun_api():
    try:
        # 构建测试请求
        contents = [
            {"role": "system", "content": DESCIRPTION_PROMPT},
            {"role": "user", "content": [
                {"type": "text", "text": "请分析这张图片并提供详细描述"},
                {"type": "image_url", "image_url": {"url": "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/13/f8/5c/05/picture-lake.jpg?w=900&h=-1&s=1"}}
            ]}
        ]
        
        # 调用Qwen API
        print("正在调用Qwen API...")
        print(f"使用模型: qwen2.5-vl-72b-instruct")
        summary = aliyun_client.chat.completions.create(
            model="qwen2.5-vl-7b-instruct",
            messages=contents,
            timeout=60  # 设置60秒超时
        )
        print("API调用成功")
        print(f"输入tokens: {summary.usage.prompt_tokens}")
        print(f"输出tokens: {summary.usage.completion_tokens}")
        return summary.choices[0].message.content, (summary.usage.prompt_tokens, summary.usage.completion_tokens)

    except Exception as e:
        print(f"测试阿里云API错误: {str(e)}")
        print(f"错误类型: {type(e)}")
        return "测试阿里云API失败", (0, 0)
    
if __name__ == "__main__":
    test_aliyun_api()